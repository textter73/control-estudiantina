import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { UserEvaluationService } from '../../services/user-evaluation.service';
import { AuthService } from '../../services/auth.service';
import { UserEvaluation, EVALUATION_CRITERIA, LEVEL_CONFIGURATIONS } from '../../models/user-evaluation.model';
import Swal from 'sweetalert2';

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
      asistenciaEnsayos: 1,
      participacionEventos: 1,
      colaboracion: 1
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

    // Cargar evaluación existente si la hay
    this.evaluationService.getUserEvaluation(this.selectedUserId).subscribe(evaluation => {
      this.existingEvaluation = evaluation || null;
      
      if (evaluation) {
        // Cargar datos de evaluación existente y asegurar que sean números
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
            asistenciaEnsayos: Number(evaluation.compromiso.asistenciaEnsayos),
            participacionEventos: Number(evaluation.compromiso.participacionEventos),
            colaboracion: Number(evaluation.compromiso.colaboracion)
          }
        };
      } else {
        // Resetear formulario para nuevo usuario
        this.resetForm();
      }
    });
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
        asistenciaEnsayos: 1,
        participacionEventos: 1,
        colaboracion: 1
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
    
    const compromisoTotal = Number(this.evaluationForm.compromiso.asistenciaEnsayos) + 
                           Number(this.evaluationForm.compromiso.participacionEventos) + 
                           Number(this.evaluationForm.compromiso.colaboracion);
    
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

  async saveEvaluation() {
    if (!this.selectedUserId || !this.selectedUser) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Selecciona un usuario para evaluar'
      });
      return;
    }

    this.isLoading = true;

    try {
      // Establecer datos básicos
      this.evaluationForm.userId = this.selectedUserId;
      this.evaluationForm.userName = this.selectedUser.name;
      this.evaluationForm.evaluatedBy = this.currentUserName; // Usar el nombre del usuario actual

      // Guardar evaluación (SIN actualizar perfil)
      await this.evaluationService.saveEvaluation(this.evaluationForm);

      // Recargar nivel del perfil después de guardar
      this.evaluationService.getUserLevelFromProfile(this.selectedUserId).subscribe(profileLevel => {
        this.userProfileLevel = profileLevel;
      });

      Swal.fire({
        icon: 'success',
        title: '¡Evaluación guardada!',
        html: `
          <div style="text-align: center;">
            <p><strong>${this.selectedUser.name}</strong> ha sido evaluado por <strong>${this.currentUserName}</strong></p>
            <br>
            <div style="background: #f0f9ff; padding: 10px; border-radius: 5px; margin: 10px 0;">
              <strong>📋 Evaluación guardada exitosamente</strong>
            </div>
          </div>
        `,
        timer: 3000,
        showConfirmButton: false
      });

      // Recargar evaluaciones
      this.loadAllEvaluations();
      
    } catch (error) {
      console.error('Error al guardar evaluación:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la evaluación'
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
    this.evaluationForm.compromiso.asistenciaEnsayos = Number(this.evaluationForm.compromiso.asistenciaEnsayos);
    this.evaluationForm.compromiso.participacionEventos = Number(this.evaluationForm.compromiso.participacionEventos);
    this.evaluationForm.compromiso.colaboracion = Number(this.evaluationForm.compromiso.colaboracion);
  }

  // Método para navegar al dashboard
  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}