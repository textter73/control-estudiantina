import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { UserEvaluationService } from '../../services/user-evaluation.service';
import { AuthService } from '../../services/auth.service';
import { UserEvaluation, EVALUATION_CRITERIA, LEVEL_CONFIGURATIONS } from '../../models/user-evaluation.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

@Component({
  selector: 'app-member-evaluation',
  templateUrl: './member-evaluation.component.html',
  styleUrls: ['./member-evaluation.component.css']
})
export class MemberEvaluationComponent implements OnInit {
  users: any[] = [];
  selectedUserId: string = '';
  selectedUser: any = null;
  currentEvaluation: UserEvaluation | null = null;
  existingEvaluation: UserEvaluation | null = null;
  userProfileLevel: {level: number, taxPercentage: number} | null = null;
  
  // Criterios de evaluación
  evaluationCriteria = EVALUATION_CRITERIA;
  levelConfigurations = LEVEL_CONFIGURATIONS;
  
  // Formulario de evaluación
  evaluationForm: UserEvaluation = {
    userId: '',
    userName: '',
    evaluatedBy: '',
    evaluatedAt: null,
    canto: {
      afinacion: 1,
      rangoVocal: 1,
      controlVocal: 1,
      expresividad: 1
    },
    instrumento: {
      tecnica: 1,
      precision: 1,
      creatividad: 1,
      versatilidad: 1
    },
    compromiso: {
      ensayos: 1,
      eventos: 1,
      misas: 1
    },
    puntuacionTotal: 0,
    nivel: 6,
    impuestoPorcentaje: 70,
    comentarios: ''
  };
  
  isLoading = false;
  isLoadingUsers = true;
  allEvaluations: UserEvaluation[] = [];
  currentUserName = '';
  
  // Sistema de evaluación por lotes
  batchEvaluations: UserEvaluation[] = [];
  evaluationPeriod: string = '';
  showBatchPanel: boolean = true; // Abierto por defecto cuando hay evaluaciones

  // Estadísticas de asistencia del usuario seleccionado
  userAttendanceStats = {
    ensayos: { percentage: 0, attended: 0, total: 0, nivel: 1 },
    eventos: { percentage: 0, attended: 0, total: 0, nivel: 1 },
    misas: { percentage: 0, attended: 0, total: 0, nivel: 1 }
  };

  /**
   * Filtra usuarios que no están en el lote actual
   */
  get availableUsers() {
    const evaluatedUserIds = this.batchEvaluations.map(e => e.userId);
    return this.users.filter(user => !evaluatedUserIds.includes(user.uid));
  }

  /**
   * Devuelve las evaluaciones del lote ordenadas por nivel (ascendente)
   */
  get sortedBatchEvaluations() {
    return [...this.batchEvaluations].sort((a, b) => a.nivel - b.nivel);
  }

  constructor(
    private firestore: AngularFirestore,
    private evaluationService: UserEvaluationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCurrentUser();
    this.loadUsers();
    this.loadAllEvaluations();
    this.loadDraftBatch(); // Cargar borrador guardado si existe
  }

  async loadCurrentUser() {
    try {
      const userData = await this.authService.getCurrentUserData();
      if (userData && (userData as any).name) {
        this.currentUserName = (userData as any).name;
      } else {
        this.currentUserName = 'Usuario Anónimo';
      }
    } catch (error) {
      console.error('Error cargando usuario actual:', error);
      this.currentUserName = 'Usuario Anónimo';
    }
  }

  async loadUsers() {
    this.isLoadingUsers = true;
    
    // Usar el mismo patrón que funciona en admin.component.ts
    this.firestore.collection('users').valueChanges({ idField: 'uid' }).subscribe({
      next: (allUsers: any[]) => {
        
        // Filtrar usuarios que NO están eliminados (mismo patrón que admin.component.ts)
        const activeUsers = allUsers.filter(user => !user.deleted);
        
        // Ordenar en el cliente por nombre
        this.users = activeUsers.sort((a, b) => {
          const nameA = a.name ? a.name.toLowerCase() : '';
          const nameB = b.name ? b.name.toLowerCase() : '';
          return nameA.localeCompare(nameB);
        });
        
        this.isLoadingUsers = false;
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        this.isLoadingUsers = false;
        
        // Mostrar error al usuario
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los usuarios. Verifica la conexión a la base de datos.'
        });
      }
    });
  }

  loadAllEvaluations() {
    this.evaluationService.getAllEvaluations().subscribe(evaluations => {
      this.allEvaluations = evaluations;
    });
  }

  async onUserSelected() {
    if (!this.selectedUserId) return;
    
    this.selectedUser = this.users.find(user => user.uid === this.selectedUserId);
    if (!this.selectedUser) return;

    // Cargar nivel del perfil del usuario
    this.evaluationService.getUserLevelFromProfile(this.selectedUserId).subscribe(profileLevel => {
      this.userProfileLevel = profileLevel;
    });

    // Cargar estadísticas de asistencia
    this.loadUserAttendance();

    // Cargar evaluación existente si la hay
    this.evaluationService.getUserEvaluation(this.selectedUserId).subscribe(evaluation => {
      this.existingEvaluation = evaluation || null;
      
      if (evaluation) {
        // Cargar datos de evaluación existente y asegurar que sean números
        // NOTA: NO cargamos compromiso porque se calcula automáticamente desde asistencia
        this.evaluationForm.canto = {
          afinacion: Number(evaluation.canto.afinacion),
          rangoVocal: Number(evaluation.canto.rangoVocal),
          controlVocal: Number(evaluation.canto.controlVocal),
          expresividad: Number(evaluation.canto.expresividad)
        };
        this.evaluationForm.instrumento = {
          tecnica: Number(evaluation.instrumento.tecnica),
          precision: Number(evaluation.instrumento.precision),
          creatividad: Number(evaluation.instrumento.creatividad),
          versatilidad: Number(evaluation.instrumento.versatilidad)
        };
        // El compromiso ya fue calculado por loadUserAttendance(), no lo sobrescribimos
      } else {
        // Resetear formulario para nuevo usuario (mantiene compromiso calculado)
        this.evaluationForm.canto = {
          afinacion: 1, rangoVocal: 1, controlVocal: 1, expresividad: 1
        };
        this.evaluationForm.instrumento = {
          tecnica: 1, precision: 1, creatividad: 1, versatilidad: 1
        };
        // El compromiso ya fue calculado por loadUserAttendance()
      }
    });
  }

  loadUserAttendance() {
    if (!this.selectedUserId) return;

    this.firestore.collection('attendance').valueChanges().subscribe((attendances: any[]) => {
      
      // Contadores por tipo de actividad
      let ensayoTotal = 0, ensayoAttended = 0;
      let eventoTotal = 0, eventoAttended = 0;
      let misaTotal = 0, misaAttended = 0;
      let userRecordsFound = 0;

      attendances.forEach(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === this.selectedUserId);
        if (userRecord) {
          userRecordsFound++;
          
          // Considerar presente si el estado es 'presente', 'escuela', o 'enfermedad'
          const wasPresent = ['presente', 'escuela', 'enfermedad'].includes(userRecord.status);

          switch (attendance.type) {
            case 'ensayo':
              ensayoTotal++;
              if (wasPresent) ensayoAttended++;
              break;
            case 'evento':
              eventoTotal++;
              if (wasPresent) eventoAttended++;
              break;
            case 'misa dominical':
              misaTotal++;
              if (wasPresent) misaAttended++;
              break;
          }
        }
      });

      // Calcular porcentajes
      const ensayoPercentage = ensayoTotal > 0 ? Math.round((ensayoAttended / ensayoTotal) * 100) : 0;
      const eventoPercentage = eventoTotal > 0 ? Math.round((eventoAttended / eventoTotal) * 100) : 0;
      const misaPercentage = misaTotal > 0 ? Math.round((misaAttended / misaTotal) * 100) : 0;

      // Convertir porcentajes a nivel (1-4)
      const ensayoNivel = this.convertPercentageToLevel(ensayoPercentage);
      const eventoNivel = this.convertPercentageToLevel(eventoPercentage);
      const misaNivel = this.convertPercentageToLevel(misaPercentage);

      // Guardar estadísticas
      this.userAttendanceStats = {
        ensayos: { percentage: ensayoPercentage, attended: ensayoAttended, total: ensayoTotal, nivel: ensayoNivel },
        eventos: { percentage: eventoPercentage, attended: eventoAttended, total: eventoTotal, nivel: eventoNivel },
        misas: { percentage: misaPercentage, attended: misaAttended, total: misaTotal, nivel: misaNivel }
      };

      // Actualizar automáticamente el formulario de evaluación con los valores calculados
      this.evaluationForm.compromiso.ensayos = ensayoNivel;
      this.evaluationForm.compromiso.eventos = eventoNivel;
      this.evaluationForm.compromiso.misas = misaNivel;
    });
  }

  convertPercentageToLevel(percentage: number): number {
    // Seguir las reglas exactas:
    // 4 puntos = 100%
    // 3 puntos = 85-99%
    // 2 puntos = 75-84%
    // 1 punto = <75%
    
    let nivel: number;
    
    if (percentage >= 100) {
      nivel = 4;  // 100%
    } else if (percentage >= 85 && percentage < 100) {
      nivel = 3;  // 85-99%
    } else if (percentage >= 75 && percentage < 85) {
      nivel = 2;  // 75-84%
    } else {
      nivel = 1;  // <75%
    }
    
    return nivel;
  }

  getAttendanceDescription(percentage: number): string {
    if (percentage >= 100) return '100% de asistencia';
    if (percentage >= 85 && percentage < 100) return '85-99% de asistencia';
    if (percentage >= 75 && percentage < 85) return '75-84% de asistencia';
    return 'Menos del 75% de asistencia';
  }

  resetForm() {
    this.evaluationForm = {
      userId: this.selectedUserId,
      userName: this.selectedUser?.name || '',
      evaluatedBy: '', // Se establecerá con el usuario actual
      evaluatedAt: null,
      canto: {
        afinacion: 1,
        rangoVocal: 1,
        controlVocal: 1,
        expresividad: 1
      },
      instrumento: {
        tecnica: 1,
        precision: 1,
        creatividad: 1,
        versatilidad: 1
      },
      compromiso: {
        ensayos: 1,
        eventos: 1,
        misas: 1
      },
      puntuacionTotal: 0,
      nivel: 6,
      impuestoPorcentaje: 70,
      comentarios: ''
    };
  }

  calculatePreviewScore(): { total: number, nivel: number, impuesto: number } {
    // Normalizar valores antes de calcular
    this.normalizeFormValues();
    
    // Asegurar que todos los valores sean números
    const cantoTotal = Number(this.evaluationForm.canto.afinacion) + 
                      Number(this.evaluationForm.canto.rangoVocal) + 
                      Number(this.evaluationForm.canto.controlVocal) + 
                      Number(this.evaluationForm.canto.expresividad);
    
    const instrumentoTotal = Number(this.evaluationForm.instrumento.tecnica) + 
                            Number(this.evaluationForm.instrumento.precision) + 
                            Number(this.evaluationForm.instrumento.creatividad) + 
                            Number(this.evaluationForm.instrumento.versatilidad);
    
    const compromisoTotal = Number(this.evaluationForm.compromiso.ensayos) + 
                           Number(this.evaluationForm.compromiso.eventos) + 
                           Number(this.evaluationForm.compromiso.misas);
    
    const total = cantoTotal + instrumentoTotal + compromisoTotal;
    
    // Determinar nivel
    let nivel = 6;
    let impuesto = 70;
    
    for (const config of LEVEL_CONFIGURATIONS) {
      if (total >= config.puntuacionMin && total <= config.puntuacionMax) {
        nivel = config.nivel;
        impuesto = config.impuestoPorcentaje;
        break;
      }
    }
    
    return { total, nivel, impuesto };
  }

  getCantoTotal(): number {
    return Number(this.evaluationForm.canto.afinacion || 0) + 
           Number(this.evaluationForm.canto.rangoVocal || 0) + 
           Number(this.evaluationForm.canto.controlVocal || 0) + 
           Number(this.evaluationForm.canto.expresividad || 0);
  }

  getInstrumentoTotal(): number {
    return Number(this.evaluationForm.instrumento.tecnica || 0) + 
           Number(this.evaluationForm.instrumento.precision || 0) + 
           Number(this.evaluationForm.instrumento.creatividad || 0) + 
           Number(this.evaluationForm.instrumento.versatilidad || 0);
  }

  getCompromisoTotal(): number {
    return Number(this.evaluationForm.compromiso.ensayos || 0) + 
           Number(this.evaluationForm.compromiso.eventos || 0) + 
           Number(this.evaluationForm.compromiso.misas || 0);
  }

  /**
   * Calcula el total de canto para una evaluación específica
   */
  getCantoTotalForEval(evaluation: UserEvaluation): number {
    return Number(evaluation.canto.afinacion || 0) + 
           Number(evaluation.canto.rangoVocal || 0) + 
           Number(evaluation.canto.controlVocal || 0) + 
           Number(evaluation.canto.expresividad || 0);
  }

  /**
   * Calcula el total de instrumento para una evaluación específica
   */
  getInstrumentoTotalForEval(evaluation: UserEvaluation): number {
    return Number(evaluation.instrumento.tecnica || 0) + 
           Number(evaluation.instrumento.precision || 0) + 
           Number(evaluation.instrumento.creatividad || 0) + 
           Number(evaluation.instrumento.versatilidad || 0);
  }

  /**
   * Calcula el total de compromiso para una evaluación específica
   */
  getCompromisoTotalForEval(evaluation: UserEvaluation): number {
    return Number(evaluation.compromiso.ensayos || 0) + 
           Number(evaluation.compromiso.eventos || 0) + 
           Number(evaluation.compromiso.misas || 0);
  }

  async saveEvaluation() {
    if (!this.selectedUserId || !this.selectedUser) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Selecciona un usuario para evaluar'
      });
      return;
    }

    if (!this.evaluationPeriod.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Período Requerido',
        text: 'Por favor ingresa el período de evaluación (ej: Marzo - Abril 2026)'
      });
      return;
    }

    // Verificar si el usuario ya fue evaluado en este lote
    const existsInBatch = this.batchEvaluations.find(e => e.userId === this.selectedUserId);
    if (existsInBatch) {
      const result = await Swal.fire({
        icon: 'question',
        title: 'Usuario ya evaluado',
        text: `${this.selectedUser.name} ya tiene una evaluación en este lote. ¿Deseas reemplazarla?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, reemplazar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      // Eliminar evaluación anterior del lote
      this.batchEvaluations = this.batchEvaluations.filter(e => e.userId !== this.selectedUserId);
    }

    // Crear evaluación con período
    const evaluation: UserEvaluation = {
      ...this.evaluationForm,
      userId: this.selectedUserId,
      userName: this.selectedUser.name,
      evaluatedBy: this.currentUserName,
      evaluationPeriod: this.evaluationPeriod.trim(),
      evaluatedAt: null // Se establecerá al guardar
    };

    // Calcular nivel
    const preview = this.calculatePreviewScore();
    evaluation.puntuacionTotal = preview.total;
    evaluation.nivel = preview.nivel;
    evaluation.impuestoPorcentaje = preview.impuesto;

    // Agregar al lote
    this.batchEvaluations.push(evaluation);

    // Abrir el panel del lote automáticamente
    this.showBatchPanel = true;

    // Auto-guardar borrador
    this.autoSaveDraft();

    Swal.fire({
      icon: 'success',
      title: '¡Agregado al lote!',
      html: `
        <div style="text-align: center;">
          <p><strong>${this.selectedUser.name}</strong> agregado al lote de evaluación</p>
          <p class="text-muted">Período: ${this.evaluationPeriod}</p>
          <br>
          <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <strong>📦 ${this.batchEvaluations.length} evaluación(es) en el lote</strong>
          </div>
        </div>
      `,
      timer: 2000,
      showConfirmButton: false
    });

    // Resetear selección para siguiente evaluación
    this.selectedUserId = '';
    this.selectedUser = null;
    this.resetForm();
  }

  async saveBatch() {
    if (this.batchEvaluations.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Lote vacío',
        text: 'No hay evaluaciones para guardar'
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'question',
      title: 'Confirmar Guardado',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p><strong>¿Guardar ${this.batchEvaluations.length} evaluación(es)?</strong></p>
          <p>Período: <strong>${this.evaluationPeriod}</strong></p>
          <br>
          <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px;">
            ${this.batchEvaluations.map(e => `
              <div style="padding: 5px; border-bottom: 1px solid #dee2e6;">
                ✓ ${e.userName} - Nivel ${e.nivel} (${e.puntuacionTotal} pts)
              </div>
            `).join('')}
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar todo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#189d98'
    });

    if (!result.isConfirmed) return;

    this.isLoading = true;

    try {
      // Guardar todas las evaluaciones
      for (const evaluation of this.batchEvaluations) {
        await this.evaluationService.saveEvaluation(evaluation);
      }

      Swal.fire({
        icon: 'success',
        title: '¡Lote guardado exitosamente!',
        html: `
          <div style="text-align: center;">
            <p><strong>${this.batchEvaluations.length} evaluación(es)</strong> guardadas correctamente</p>
            <p>Período: <strong>${this.evaluationPeriod}</strong></p>
          </div>
        `,
        timer: 3000,
        showConfirmButton: false
      });

      // Limpiar lote
      this.batchEvaluations = [];
      this.evaluationPeriod = '';
      this.showBatchPanel = false;

      // Limpiar borrador guardado
      this.clearDraftBatch();

      // Recargar evaluaciones
      this.loadAllEvaluations();

    } catch (error) {
      console.error('Error al guardar lote:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar el lote de evaluaciones'
      });
    }

    this.isLoading = false;
  }

  getUserEvaluation(userId: string): UserEvaluation | null {
    return this.allEvaluations.find(evaluation => evaluation.userId === userId) || null;
  }

  getLevelBadgeClass(nivel: number): string {
    switch (nivel) {
      case 1: return 'level-1';
      case 2: return 'level-2';
      case 3: return 'level-3';
      case 4: return 'level-4';
      case 5: return 'level-5';
      case 6: return 'level-6';
      default: return 'level-6';
    }
  }

  getCriteriaDescription(criteriaKey: string, value: number): string {
    const criteria = this.evaluationCriteria[criteriaKey];
    const level = criteria?.levels.find(l => l.value === value);
    return level?.description || '';
  }

  getEvaluationDate(date: any): Date {
    // Si es un timestamp de Firestore, usar toDate()
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    // Si ya es una Date, retornarla directamente
    if (date instanceof Date) {
      return date;
    }
    // Si es un string, convertirlo a Date
    if (typeof date === 'string') {
      return new Date(date);
    }
    // Fallback a fecha actual
    return new Date();
  }

  async deleteEvaluation(evaluationId: string) {
    const result = await Swal.fire({
      title: '¿Eliminar evaluación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await this.evaluationService.deleteEvaluation(evaluationId);
        this.loadAllEvaluations();
        
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'La evaluación ha sido eliminada',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo eliminar la evaluación'
        });
      }
    }
  }

  // Método para truncar texto en móviles
  truncateForMobile(text: string, maxLength: number = 30): string {
    if (typeof window !== 'undefined' && window.innerWidth <= 480) {
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    return text;
  }

  // Obtener texto de opción optimizado para móvil
  getOptionText(level: any): string {
    const fullText = `${level.label} - ${level.description}`;
    return this.truncateForMobile(fullText, 25);
  }

  // Método para convertir valores a números cuando cambian los select
  convertToNumber(category: 'canto' | 'instrumento' | 'compromiso', field: string, event: any) {
    const value = Number(event.target.value);
    (this.evaluationForm[category] as any)[field] = value;
  }

  // Método para normalizar todos los valores del formulario a números
  normalizeFormValues() {
    // Canto
    this.evaluationForm.canto.afinacion = Number(this.evaluationForm.canto.afinacion);
    this.evaluationForm.canto.rangoVocal = Number(this.evaluationForm.canto.rangoVocal);
    this.evaluationForm.canto.controlVocal = Number(this.evaluationForm.canto.controlVocal);
    this.evaluationForm.canto.expresividad = Number(this.evaluationForm.canto.expresividad);
    
    // Instrumento
    this.evaluationForm.instrumento.tecnica = Number(this.evaluationForm.instrumento.tecnica);
    this.evaluationForm.instrumento.precision = Number(this.evaluationForm.instrumento.precision);
    this.evaluationForm.instrumento.creatividad = Number(this.evaluationForm.instrumento.creatividad);
    this.evaluationForm.instrumento.versatilidad = Number(this.evaluationForm.instrumento.versatilidad);
    
    // Compromiso
    this.evaluationForm.compromiso.ensayos = Number(this.evaluationForm.compromiso.ensayos);
    this.evaluationForm.compromiso.eventos = Number(this.evaluationForm.compromiso.eventos);
    this.evaluationForm.compromiso.misas = Number(this.evaluationForm.compromiso.misas);
  }

  // Métodos para manejo de lotes
  removeFromBatch(userId: string) {
    const evaluation = this.batchEvaluations.find(e => e.userId === userId);
    if (!evaluation) return;

    Swal.fire({
      title: '¿Eliminar del lote?',
      text: `Se eliminará la evaluación de ${evaluation.userName}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.batchEvaluations = this.batchEvaluations.filter(e => e.userId !== userId);
        
        // Auto-guardar o limpiar si está vacío
        if (this.batchEvaluations.length > 0) {
          this.autoSaveDraft();
        } else {
          this.clearDraftBatch();
        }
        
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'Evaluación eliminada del lote',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  editBatchEvaluation(userId: string) {
    const evaluation = this.batchEvaluations.find(e => e.userId === userId);
    if (!evaluation) return;

    // Remover del lote
    this.batchEvaluations = this.batchEvaluations.filter(e => e.userId !== userId);

    // Auto-guardar cambios
    if (this.batchEvaluations.length > 0) {
      this.autoSaveDraft();
    } else {
      this.clearDraftBatch();
    }

    // Cargar en el formulario
    this.selectedUserId = userId;
    this.selectedUser = this.users.find(u => u.uid === userId);
    this.evaluationForm = {
      ...evaluation,
      canto: {
        afinacion: Number(evaluation.canto.afinacion),
        rangoVocal: Number(evaluation.canto.rangoVocal),
        controlVocal: Number(evaluation.canto.controlVocal),
        expresividad: Number(evaluation.canto.expresividad)
      },
      instrumento: {
        tecnica: Number(evaluation.instrumento.tecnica),
        precision: Number(evaluation.instrumento.precision),
        creatividad: Number(evaluation.instrumento.creatividad),
        versatilidad: Number(evaluation.instrumento.versatilidad)
      },
      compromiso: {
        ensayos: Number(evaluation.compromiso.ensayos),
        eventos: Number(evaluation.compromiso.eventos),
        misas: Number(evaluation.compromiso.misas)
      }
    };

    // Scroll hacia arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });

    Swal.fire({
      icon: 'info',
      title: 'Editando evaluación',
      text: `Modifica la evaluación de ${evaluation.userName} y vuelve a agregarla`,
      timer: 2000,
      showConfirmButton: false
    });
  }

  cancelBatch() {
    if (this.batchEvaluations.length === 0) {
      this.showBatchPanel = false;
      return;
    }

    Swal.fire({
      title: '¿Cancelar lote completo?',
      text: `Se perderán ${this.batchEvaluations.length} evaluación(es) sin guardar`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No',
      confirmButtonColor: '#d33'
    }).then((result) => {
      if (result.isConfirmed) {
        this.batchEvaluations = [];
        this.evaluationPeriod = '';
        this.showBatchPanel = false;
        
        // Limpiar borrador guardado
        this.clearDraftBatch();
        
        Swal.fire({
          icon: 'success',
          title: 'Lote cancelado',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  toggleBatchPanel() {
    this.showBatchPanel = !this.showBatchPanel;
  }

  // ============= EXPORTAR A PDF =============
  
  /**
   * Genera un PDF con el formato de evaluación
   */
  exportToPDF() {
    if (this.batchEvaluations.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Lote vacío',
        text: 'No hay evaluaciones para exportar'
      });
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Título
      const currentYear = new Date().getFullYear();
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`EVALUACIÓN ${this.evaluationPeriod || currentYear}`, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

      // Preparar datos para la tabla
      const sortedEvals = this.sortedBatchEvaluations;
      
      const tableData = sortedEvals.map(evaluation => {
        const instrumento = evaluation.instrumento;
        const canto = evaluation.canto;
        const compromiso = evaluation.compromiso;
        
        const compromisoTotal = Number(compromiso.ensayos) + Number(compromiso.eventos) + Number(compromiso.misas);
        const total = this.getCantoTotalForEval(evaluation) + 
                     this.getInstrumentoTotalForEval(evaluation) + 
                     compromisoTotal;

        return [
          evaluation.userName,
          instrumento.tecnica,
          instrumento.precision,
          instrumento.creatividad,
          instrumento.versatilidad,
          canto.afinacion,
          canto.rangoVocal,
          canto.controlVocal,
          canto.expresividad,
          compromisoTotal,
          total,
          evaluation.nivel,
          evaluation.impuestoPorcentaje + '%'
        ];
      });

      // Generar tabla
      (doc as any).autoTable({
        startY: 25,
        head: [[
          'Nombre',
          { content: 'HABILIDAD EN EL INSTRUMENTO', colSpan: 4, styles: { halign: 'center', fillColor: [24, 157, 152] } },
          { content: 'HABILIDADES EN EL CANTO', colSpan: 4, styles: { halign: 'center', fillColor: [24, 157, 152] } },
          'ASISTENCIA',
          'TOTAL',
          'NIVEL',
          'Impuesto'
        ], [
          '',
          'Técnica',
          'Precisión',
          'Creatividad',
          'Versatilidad',
          'Afinación',
          'Rango Vocal',
          'Control Vocal',
          'Expresividad',
          'Puntos',
          '',
          '',
          ''
        ]],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [24, 157, 152],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
          halign: 'center',
          valign: 'middle'
        },
        columnStyles: {
          0: { halign: 'left', cellWidth: 40 }, // Nombre
          1: { cellWidth: 15 },  // Técnica
          2: { cellWidth: 15 },  // Precisión
          3: { cellWidth: 15 },  // Creatividad
          4: { cellWidth: 17 },  // Versatilidad
          5: { cellWidth: 15 },  // Afinación
          6: { cellWidth: 17 },  // Rango Vocal
          7: { cellWidth: 17 },  // Control Vocal
          8: { cellWidth: 17 },  // Expresividad
          9: { cellWidth: 15 },  // ASISTENCIA
          10: { cellWidth: 15, fontStyle: 'bold' }, // TOTAL
          11: { cellWidth: 15, fontStyle: 'bold' }, // NIVEL
          12: { cellWidth: 18 }  // Impuesto
        },
        didDrawCell: (data: any) => {
          // Colorear filas según nivel
          if (data.section === 'body' && data.column.index === 11) {
            const nivel = tableData[data.row.index][11];
            let color;
            switch(nivel) {
              case 1: color = [40, 167, 69]; break;   // Verde
              case 2: color = [32, 201, 151]; break;  // Verde agua
              case 3: color = [52, 152, 219]; break;  // Azul
              case 4: color = [155, 89, 182]; break;  // Púrpura
              case 5: color = [243, 156, 18]; break;  // Naranja
              case 6: color = [231, 76, 60]; break;   // Rojo
              default: color = [108, 117, 125];
            }
            doc.setFillColor(color[0], color[1], color[2]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(nivel.toString(), data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
          }
        }
      });

      // Guardar PDF
      const filename = `Evaluacion_${this.evaluationPeriod || currentYear}_${new Date().getTime()}.pdf`;
      doc.save(filename);

      Swal.fire({
        icon: 'success',
        title: '¡PDF Generado!',
        text: `Se ha descargado ${filename}`,
        timer: 2500,
        showConfirmButton: false
      });

    } catch (error) {
      console.error('Error generando PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF'
      });
    }
  }

  // ============= SISTEMA DE GUARDADO EN BORRADOR =============
  
  private readonly DRAFT_STORAGE_KEY = 'evaluation_batch_draft';

  /**
   * Guarda el lote actual en localStorage como borrador
   */
  saveDraftBatch() {
    if (this.batchEvaluations.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Lote vacío',
        text: 'No hay evaluaciones para guardar como borrador'
      });
      return;
    }

    try {
      const draft = {
        evaluations: this.batchEvaluations,
        period: this.evaluationPeriod,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(draft));

      Swal.fire({
        icon: 'success',
        title: '💾 Borrador Guardado',
        html: `
          <div style="text-align: center;">
            <p>Se ha guardado el progreso de <strong>${this.batchEvaluations.length} evaluación(es)</strong></p>
            <p class="text-muted">Puedes cerrar y continuar después</p>
          </div>
        `,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error guardando borrador:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar el borrador'
      });
    }
  }

  /**
   * Carga el borrador guardado desde localStorage
   */
  loadDraftBatch() {
    try {
      const draftJson = localStorage.getItem(this.DRAFT_STORAGE_KEY);
      if (!draftJson) return;

      const draft = JSON.parse(draftJson);
      
      // Verificar que el borrador tenga datos válidos
      if (draft.evaluations && Array.isArray(draft.evaluations) && draft.evaluations.length > 0) {
        this.batchEvaluations = draft.evaluations;
        this.evaluationPeriod = draft.period || '';
        this.showBatchPanel = true;

        // Mostrar notificación de que se recuperó un borrador
        const savedDate = new Date(draft.savedAt);
        const timeAgo = this.getTimeAgo(savedDate);

        Swal.fire({
          icon: 'info',
          title: '📋 Borrador Recuperado',
          html: `
            <div style="text-align: center;">
              <p>Se encontró un borrador con <strong>${this.batchEvaluations.length} evaluación(es)</strong></p>
              <p class="text-muted">Guardado ${timeAgo}</p>
              <p class="text-muted">Período: <strong>${this.evaluationPeriod}</strong></p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'Continuar con borrador',
          cancelButtonText: 'Descartar borrador',
          confirmButtonColor: '#189d98'
        }).then((result) => {
          if (!result.isConfirmed) {
            // Usuario decidió descartar el borrador
            this.clearDraftBatch();
            this.batchEvaluations = [];
            this.evaluationPeriod = '';
            this.showBatchPanel = false;
          }
        });
      }
    } catch (error) {
      console.error('Error cargando borrador:', error);
      // Si hay error, limpiar el localStorage
      localStorage.removeItem(this.DRAFT_STORAGE_KEY);
    }
  }

  /**
   * Limpia el borrador de localStorage
   */
  clearDraftBatch() {
    localStorage.removeItem(this.DRAFT_STORAGE_KEY);
  }

  /**
   * Guarda automáticamente en localStorage cada vez que cambia el lote
   */
  private autoSaveDraft() {
    if (this.batchEvaluations.length > 0) {
      try {
        const draft = {
          evaluations: this.batchEvaluations,
          period: this.evaluationPeriod,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(this.DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (error) {
        console.error('Error en auto-guardado:', error);
      }
    }
  }

  /**
   * Calcula tiempo transcurrido desde una fecha
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'hace unos momentos';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  }

  // Método para navegar al dashboard
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  // ============= UTILIDAD: CORREGIR USERID EN EVALUACIONES =============
  
  /**
   * Corrige el userId en todas las evaluaciones existentes
   * para que coincidan con el uid real del usuario
   */
  async fixUserIdInAllEvaluations() {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Corregir userId en Evaluaciones',
      html: `
        <div style="text-align: left; padding: 10px;">
          <p>Esta función actualizará el campo <code>userId</code> en todas las evaluaciones existentes para que coincidan con el UID real de cada usuario.</p>
          <br>
          <p><strong>⚠️ Esta operación modificará la base de datos.</strong></p>
          <p>¿Deseas continuar?</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, corregir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#189d98'
    });

    if (!result.isConfirmed) return;

    this.isLoading = true;

    try {
      const result = await this.evaluationService.fixUserIdInEvaluations();
      
      const alreadyCorrect = result.total - result.updated - result.notFound;
      
      Swal.fire({
        icon: 'success',
        title: '✅ Corrección Completada',
        html: `
          <div style="text-align: center;">
            <p><strong>📊 Resultado:</strong></p>
            <p>✅ Actualizadas: ${result.updated}</p>
            <p>✓ Ya correctas: ${alreadyCorrect}</p>
            ${result.notFound > 0 ? `<p>❌ Sin usuario: ${result.notFound}</p>` : ''}
            <p class="text-muted">Total evaluaciones: ${result.total}</p>
          </div>
        `,
        confirmButtonText: 'Entendido'
      });

      // Recargar evaluaciones
      this.loadAllEvaluations();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron corregir las evaluaciones. Por favor, intenta nuevamente.'
      });
    } finally {
      this.isLoading = false;
    }
  }
}