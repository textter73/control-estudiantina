import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import { UserEvaluationService } from '../../services/user-evaluation.service';
import { NotificationService } from '../../services/notification.service';

interface PayrollEmployee {
  id: string;
  name: string;
  level: number;
  taxPercentage: number;
  attended: boolean;
  gross: number;
  tax: number;
  net: number;
}

interface PayrollData {
  contractName: string;
  contractAmount: number;
  attendees: number;
  unitAmount: number;
  totalGross: number;
  totalTax: number;
  totalNet: number;
  employees: PayrollEmployee[];
  createdAt: Date;
  createdBy: string;
  status: 'validacion' | 'completada'; // validacion = pendiente de aprobación, completada = finalizada
  updatedAt?: Date; // Fecha de última actualización en validación
  validatedAt?: Date;
}

@Component({
  selector: 'app-contract-distribution',
  templateUrl: './contract-distribution.component.html',
  styleUrls: ['./contract-distribution.component.css']
})
export class ContractDistributionComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  
  // Datos del contrato
  contractName: string = '';
  contractAmount: number = 0;
  
  // Lista de empleados
  allEmployees: PayrollEmployee[] = [];
  
  // Calculados
  attendees: number = 0;
  unitAmount: number = 0;
  totalGross: number = 0;
  totalTax: number = 0;
  totalNet: number = 0;
  
  // Modal de previsualización
  showPreviewModal: boolean = false;
  
  // Cuenta de estudiantina
  estudiantinaAccount: any = null;

  // ID de nómina en validación (si existe)
  currentPayrollId: string | null = null;
  payrollStatus: 'nuevo' | 'validacion' | 'completada' = 'nuevo';
  lastUpdatedAt: Date | null = null; // Fecha de última actualización

  // Modal de nóminas en validación
  showValidationListModal: boolean = false;
  validationPayrolls: any[] = [];

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router,
    private userEvaluationService: UserEvaluationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        if (this.canManagePayroll()) {
          await this.loadUsers();
          await this.loadEstudiantinaAccount();
          await this.loadValidationPayrolls();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManagePayroll(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  get attendedEmployees(): PayrollEmployee[] {
    return this.allEmployees.filter(e => e.attended);
  }

  async loadUsers() {
    try {
      const usersSnapshot = await this.firestore.collection('users').get().toPromise();
      
      this.allEmployees = [];
      const usersWithoutEvaluation: string[] = [];
      
      for (const doc of usersSnapshot?.docs || []) {
        const userData = doc.data() as any;
        const userName = userData.name || userData.email;
        
        // Excluir usuario de estudiantina tonantzin Guadalupe
        const normalizedName = userName.toLowerCase().trim();
        if (normalizedName.includes('estudiantina') && 
            normalizedName.includes('tonantzin') && 
            normalizedName.includes('guadalupe')) {
          continue; // Saltar este usuario
        }
        
        // Solo usuarios activos
        if (!userData.deleted) {
          
          // Obtener la última evaluación del usuario directamente desde Firestore
          try {
            const evaluationsSnapshot = await this.firestore.collection('user-evaluations', ref =>
              ref.where('userId', '==', doc.id)
            ).get().toPromise();
            
            if (evaluationsSnapshot && evaluationsSnapshot.docs.length > 0) {
              // Ordenar las evaluaciones por fecha (más reciente primero) en memoria
              const sortedDocs = evaluationsSnapshot.docs.sort((a, b) => {
                const dataA = a.data() as any;
                const dataB = b.data() as any;
                const dateA = dataA.evaluatedAt?.toDate ? dataA.evaluatedAt.toDate() : new Date(dataA.evaluatedAt || 0);
                const dateB = dataB.evaluatedAt?.toDate ? dataB.evaluatedAt.toDate() : new Date(dataB.evaluatedAt || 0);
                return dateB.getTime() - dateA.getTime();
              });
              
              // Tomar la evaluación más reciente
              const evaluationData = sortedDocs[0].data() as any;
              
              this.allEmployees.push({
                id: doc.id,
                name: userName,
                level: evaluationData.nivel || 1,
                taxPercentage: evaluationData.impuestoPorcentaje || 40,
                attended: false,
                gross: 0,
                tax: 0,
                net: 0
              });
            } else {
              // Usuario NO tiene evaluación - agregar a la lista de alertas
              usersWithoutEvaluation.push(userName);
              
              // Agregar con valores por defecto (nivel 1, 40% impuesto)
              this.allEmployees.push({
                id: doc.id,
                name: userName,
                level: 1,
                taxPercentage: 40,
                attended: false,
                gross: 0,
                tax: 0,
                net: 0
              });
            }
          } catch (error) {
            console.error(`Error obteniendo evaluación para ${userName}:`, error);
            // En caso de error, agregar con valores por defecto
            usersWithoutEvaluation.push(userName);
            this.allEmployees.push({
              id: doc.id,
              name: userName,
              level: 1,
              taxPercentage: 40,
              attended: false,
              gross: 0,
              tax: 0,
              net: 0
            });
          }
        }
      }
      
      // Ordenar por nivel (ascendente 1-6) y luego por nombre
      this.allEmployees.sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level; // Nivel 1 primero, luego 2, 3, 4, 5, 6
        }
        return a.name.localeCompare(b.name); // Mismo nivel, ordenar por nombre
      });
      
      console.log(`✅ Usuarios cargados: ${this.allEmployees.length}`);
      
      // Mostrar alerta si hay usuarios sin evaluación
      if (usersWithoutEvaluation.length > 0) {
        const usersList = usersWithoutEvaluation.map(name => `• ${name}`).join('<br>');
        await Swal.fire({
          icon: 'warning',
          title: '⚠️ Usuarios sin Evaluación',
          html: `
            <p>Los siguientes usuarios NO tienen evaluaciones registradas y se les asignó <strong>Nivel 1 (40% impuesto)</strong> por defecto:</p>
            <div style="text-align: left; margin: 20px auto; max-width: 400px;">
              ${usersList}
            </div>
            <p style="margin-top: 20px; color: #666;">Por favor, evalúa a estos usuarios para asignarles el nivel e impuesto correcto.</p>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#189d98'
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los usuarios'
      });
    }
  }

  async loadEstudiantinaAccount() {
    try {
      const accountsSnapshot = await this.firestore.collection('financial-accounts', ref =>
        ref.where('accountType', '==', 'estudiantina')
      ).get().toPromise();

      if (accountsSnapshot && accountsSnapshot.docs.length > 0) {
        const doc = accountsSnapshot.docs[0];
        this.estudiantinaAccount = { id: doc.id, ...(doc.data() as any) };
      }
    } catch (error) {
      console.error('Error loading estudiantina account:', error);
    }
  }

  async loadValidationPayrolls() {
    try {
      const payrollsSnapshot = await this.firestore.collection('payrolls', ref =>
        ref.where('status', '==', 'validacion')
      ).get().toPromise();

      if (!payrollsSnapshot || payrollsSnapshot.empty) {
        this.validationPayrolls = [];
        console.log('⚠️ No hay nóminas en validación');
        return;
      }

      this.validationPayrolls = payrollsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      // Ordenar por fecha en memoria (más reciente primero)
      this.validationPayrolls.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Nóminas en validación cargadas: ${this.validationPayrolls.length}`);
      this.validationPayrolls.forEach(p => {
        console.log(`  - ${p.contractName} (${p.attendees} asistentes)`);
      });
    } catch (error) {
      console.error('❌ Error loading validation payrolls:', error);
      this.validationPayrolls = [];
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar nóminas',
        text: 'No se pudieron cargar las nóminas en validación. Revisa la consola para más detalles.',
        confirmButtonColor: '#dc2626'
      });
    }
  }

  async openValidationList() {
    // Recargar las nóminas antes de abrir el modal
    await this.loadValidationPayrolls();

    if (this.validationPayrolls.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin nóminas pendientes',
        text: 'No hay nóminas en validación en este momento',
        confirmButtonColor: '#189d98'
      });
      return;
    }
    this.showValidationListModal = true;
  }

  closeValidationList() {
    this.showValidationListModal = false;
  }

  goToHistory() {
    this.router.navigate(['/payroll-history']);
  }

  async loadPayroll(payroll: any) {
    try {
      // Confirmar carga
      const result = await Swal.fire({
        title: '📂 Cargar Nómina',
        html: `
          <p>¿Deseas cargar la siguiente nómina en validación?</p>
          <br>
          <p><strong>Contrato:</strong> ${payroll.contractName}</p>
          <p><strong>Monto:</strong> $${payroll.contractAmount}</p>
          <p><strong>Asistentes:</strong> ${payroll.attendees}</p>
          <p><strong>Creada:</strong> ${payroll.createdAt?.toDate ? payroll.createdAt.toDate().toLocaleDateString('es-MX') : 'N/A'}</p>
          <br>
          <p style="color: #666;">Se cargarán todos los datos para continuar el proceso.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, cargar',
        confirmButtonColor: '#189d98',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      // Cargar datos de la nómina
      this.contractName = payroll.contractName;
      this.contractAmount = payroll.contractAmount;
      this.attendees = payroll.attendees;
      this.unitAmount = payroll.unitAmount;
      this.totalGross = payroll.totalGross;
      this.totalTax = payroll.totalTax;
      this.totalNet = payroll.totalNet;
      this.currentPayrollId = payroll.id;
      this.payrollStatus = 'validacion';
      this.lastUpdatedAt = payroll.updatedAt?.toDate ? payroll.updatedAt.toDate() : null;

      // Marcar los empleados que asistieron y sus cantidades
      const attendedEmployeeIds = payroll.employees.map((e: any) => e.id);
      
      this.allEmployees.forEach(employee => {
        const payrollEmployee = payroll.employees.find((e: any) => e.id === employee.id);
        if (payrollEmployee) {
          employee.attended = true;
          employee.gross = payrollEmployee.gross;
          employee.tax = payrollEmployee.tax;
          employee.net = payrollEmployee.net;
        } else {
          employee.attended = false;
          employee.gross = 0;
          employee.tax = 0;
          employee.net = 0;
        }
      });

      this.closeValidationList();

      Swal.fire({
        icon: 'success',
        title: '✅ Nómina Cargada',
        text: 'Puedes modificar los datos y luego generar la nómina final',
        timer: 2500,
        confirmButtonColor: '#10b981'
      });

    } catch (error) {
      console.error('Error loading payroll:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar la nómina'
      });
    }
  }

  async deleteValidationPayroll(payroll?: any) {
    try {
      // Si no se proporciona payroll, usar la actual cargada
      const payrollToDelete = payroll || { 
        id: this.currentPayrollId, 
        contractName: this.contractName 
      };

      if (!payrollToDelete.id) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No hay nómina para eliminar'
        });
        return;
      }

      // Confirmar eliminación
      const result = await Swal.fire({
        title: '🗑️ Eliminar Nómina en Validación',
        html: `
          <p>¿Estás seguro de eliminar esta nómina?</p>
          <br>
          <p><strong>Contrato:</strong> ${payrollToDelete.contractName || this.contractName}</p>
          <br>
          <p style="color: #dc2626; font-weight: bold;">⚠️ Esta acción no se puede deshacer.</p>
          <p style="color: #666;">No se han registrado transacciones aún, solo se eliminará el registro de validación.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        confirmButtonColor: '#dc2626',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      // Eliminar documento de Firestore
      await this.firestore.collection('payrolls').doc(payrollToDelete.id).delete();
      
      console.log(`🗑️ Nómina eliminada - ID: ${payrollToDelete.id}`);

      // Recargar lista de validaciones
      await this.loadValidationPayrolls();

      // Si era la nómina actual, limpiar formulario
      if (payrollToDelete.id === this.currentPayrollId) {
        this.resetForm();
      }

      Swal.fire({
        icon: 'success',
        title: '✅ Nómina Eliminada',
        text: 'La nómina en validación ha sido eliminada exitosamente',
        timer: 2500,
        confirmButtonColor: '#10b981'
      });

    } catch (error) {
      console.error('❌ Error deleting payroll:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo eliminar la nómina'
      });
    }
  }

  calculateDistribution() {
    if (!this.contractAmount || this.contractAmount <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto inválido',
        text: 'Ingresa un monto válido para el contrato'
      });
      return;
    }

    if (!this.contractName || this.contractName.trim() === '') {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre requerido',
        text: 'Ingresa un nombre para el contrato'
      });
      return;
    }

    // Contar asistentes
    this.attendees = this.allEmployees.filter(e => e.attended).length;

    if (this.attendees === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin asistentes',
        text: 'Selecciona al menos un asistente'
      });
      return;
    }

    // Calcular monto unitario
    this.unitAmount = Math.round(this.contractAmount / this.attendees);

    // Calcular distribución
    this.totalGross = 0;
    this.totalTax = 0;
    this.totalNet = 0;

    this.allEmployees.forEach(employee => {
      if (employee.attended) {
        employee.gross = this.unitAmount;
        employee.tax = Math.round((employee.gross * employee.taxPercentage) / 100);
        employee.net = employee.gross - employee.tax;
        
        this.totalGross += employee.gross;
        this.totalTax += employee.tax;
        this.totalNet += employee.net;
      } else {
        employee.gross = 0;
        employee.tax = 0;
        employee.net = 0;
      }
    });

    // Cálculo completado sin mensaje
  }

  markAllAttendance(attended: boolean) {
    this.allEmployees.forEach(employee => {
      employee.attended = attended;
    });
    
    // Recalcular automáticamente si hay monto
    if (this.contractAmount > 0) {
      this.calculateDistribution();
    }
  }

  toggleAttendance(employee: PayrollEmployee) {
    employee.attended = !employee.attended;
    // Recalcular automáticamente
    if (this.contractAmount > 0) {
      this.calculateDistribution();
    }
  }

  updateEmployeeData(employee: PayrollEmployee, field: string, value: any) {
    if (field === 'gross') {
      employee.gross = Math.round(parseFloat(value) || 0);
      employee.tax = Math.round((employee.gross * employee.taxPercentage) / 100);
      employee.net = employee.gross - employee.tax;
    } else if (field === 'taxPercentage') {
      employee.taxPercentage = parseFloat(value) || 0;
      employee.tax = Math.round((employee.gross * employee.taxPercentage) / 100);
      employee.net = employee.gross - employee.tax;
    }

    this.recalculateTotals();
  }

  recalculateTotals() {
    this.totalGross = 0;
    this.totalTax = 0;
    this.totalNet = 0;

    this.allEmployees.forEach(employee => {
      if (employee.attended) {
        this.totalGross += employee.gross;
        this.totalTax += employee.tax;
        this.totalNet += employee.net;
      }
    });

    this.attendees = this.allEmployees.filter(e => e.attended).length;
  }

  openPreview() {
    if (this.attendees === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'Calcula la distribución primero'
      });
      return;
    }

    this.showPreviewModal = true;
  }

  closePreview() {
    this.showPreviewModal = false;
  }

  async sendToValidation() {
    try {
      // Validar datos
      if (!this.contractName || this.contractAmount <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Datos incompletos',
          text: 'Completa el nombre del contrato y el monto'
        });
        return;
      }

      if (this.attendees === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin asistentes',
          text: 'Marca al menos un asistente'
        });
        return;
      }

      // Detectar si es creación o actualización
      const isUpdate = this.currentPayrollId && this.payrollStatus === 'validacion';
      const actionTitle = isUpdate ? '🔄 Actualizar Validación' : '📋 Enviar a Validación';
      const actionVerb = isUpdate ? 'actualizar' : 'enviar a validación';
      const confirmText = isUpdate ? 'Sí, actualizar' : 'Sí, enviar a validación';

      // Confirmar acción
      const result = await Swal.fire({
        title: actionTitle,
        html: `
          <p>${isUpdate ? 'Se <strong>actualizarán</strong> los datos de la nómina y se' : 'Se'} generará un <strong>PDF preliminar</strong> ${isUpdate ? 'actualizado' : ''} para que todos verifiquen sus datos.</p>
          <br>
          <p><strong>Contrato:</strong> ${this.contractName}</p>
          <p><strong>Monto total:</strong> $${this.contractAmount}</p>
          <p><strong>Asistentes:</strong> ${this.attendees}</p>
          <p><strong>Impuestos a Estudiantina:</strong> $${this.totalTax}</p>
          <br>
          <p style="color: #666;">⚠️ Aún no se registrarán transacciones ni se generarán PDFs individuales.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: confirmText,
        confirmButtonColor: '#f59e0b',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      // Preparar datos de la nómina
      const payrollData: any = {
        contractName: this.contractName,
        contractAmount: this.contractAmount,
        attendees: this.attendees,
        unitAmount: this.unitAmount,
        totalGross: this.totalGross,
        totalTax: this.totalTax,
        totalNet: this.totalNet,
        employees: this.allEmployees.filter(e => e.attended),
        status: 'validacion'
      };

      if (isUpdate) {
        // ACTUALIZAR nómina existente
        payrollData.updatedAt = new Date();
        await this.firestore.collection('payrolls').doc(this.currentPayrollId!).update(payrollData);
        this.lastUpdatedAt = payrollData.updatedAt; // Guardar fecha de actualización
        console.log(`🔄 Nómina actualizada en validación - ID: ${this.currentPayrollId}`);
        console.log('Datos actualizados:', payrollData);
      } else {
        // CREAR nueva nómina
        payrollData.createdAt = new Date();
        payrollData.createdBy = this.user.uid;
        const payrollDoc = await this.firestore.collection('payrolls').add(payrollData);
        this.currentPayrollId = payrollDoc.id;
        this.payrollStatus = 'validacion';
        console.log(`✅ Nómina nueva guardada en validación - ID: ${payrollDoc.id}`);
        console.log('Datos guardados:', payrollData);
      }

      // Recargar lista de nóminas en validación
      await this.loadValidationPayrolls();

      // Generar solo el PDF general (preliminar)
      this.generateGeneralPDF();

      Swal.fire({
        icon: 'success',
        title: isUpdate ? '✅ Validación Actualizada' : '✅ Enviado a Validación',
        html: `
          <p>PDF preliminar generado exitosamente.</p>
          <p>Comparte el PDF con los integrantes para que verifiquen sus datos.</p>
          <br>
          <p style="color: #059669; font-weight: bold;">${isUpdate ? 'Puedes seguir modificando y actualizando cuantas veces necesites.' : 'Una vez validado, puedes generar la nómina final.'}</p>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#10b981'
      });

      this.closePreview();

    } catch (error) {
      console.error('Error sending to validation:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo enviar a validación'
      });
    }
  }

  async saveAndGeneratePDFs() {
    try {
      // Confirmar acción
      const result = await Swal.fire({
        title: '🎯 Generar Nómina Final',
        html: `
          <p><strong>Contrato:</strong> ${this.contractName}</p>
          <p><strong>Monto total:</strong> $${this.contractAmount}</p>
          <p><strong>Asistentes:</strong> ${this.attendees}</p>
          <p><strong>Impuestos a Estudiantina:</strong> $${this.totalTax}</p>
          <br>
          <p style="color: #dc2626; font-weight: bold;">⚠️ Se registrarán las transacciones financieras y se generarán los PDFs individuales.</p>
          <p style="color: #666;">Esta acción es irreversible.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, generar nómina final',
        confirmButtonColor: '#10b981',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;

      let payrollDocId: string;

      // Si ya existe una nómina en validación, actualizarla; si no, crear nueva
      if (this.currentPayrollId && this.payrollStatus === 'validacion') {
        // Actualizar nómina existente a status 'completada'
        await this.firestore.collection('payrolls').doc(this.currentPayrollId).update({
          status: 'completada',
          validatedAt: new Date(),
          employees: this.allEmployees.filter(e => e.attended),
          // Actualizar valores por si se modificaron después de la validación
          attendees: this.attendees,
          unitAmount: this.unitAmount,
          totalGross: this.totalGross,
          totalTax: this.totalTax,
          totalNet: this.totalNet
        });
        payrollDocId = this.currentPayrollId;
      } else {
        // Crear nueva nómina directamente completada
        const payrollData: PayrollData = {
          contractName: this.contractName,
          contractAmount: this.contractAmount,
          attendees: this.attendees,
          unitAmount: this.unitAmount,
          totalGross: this.totalGross,
          totalTax: this.totalTax,
          totalNet: this.totalNet,
          employees: this.allEmployees.filter(e => e.attended),
          createdAt: new Date(),
          createdBy: this.user.uid,
          status: 'completada',
          validatedAt: new Date()
        };
        const payrollDoc = await this.firestore.collection('payrolls').add(payrollData);
        payrollDocId = payrollDoc.id;
      }

      // Registrar transacciones financieras
      await this.registerTransactions(payrollDocId);

      // Generar PDFs
      this.generateGeneralPDF();
      this.generateIndividualPDFs();

      Swal.fire({
        icon: 'success',
        title: '✅ ¡Nómina Completada!',
        text: 'PDFs descargados y transacciones registradas exitosamente',
        timer: 3000,
        confirmButtonColor: '#10b981'
      });

      // Limpiar formulario
      this.resetForm();
      this.closePreview();

    } catch (error) {
      console.error('Error saving payroll:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar la nómina'
      });
    }
  }

  // Helper para descargar PDFs compatible con iOS
  private downloadPDF(doc: any, filename: string) {
    try {
      // Detectar si es iOS/Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      
      if (isIOS || isSafari) {
        // Método compatible con iOS
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        // Crear enlace temporal
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        // Agregar al DOM, hacer click y remover
        document.body.appendChild(link);
        link.click();
        
        // Limpiar después de un delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      } else {
        // Método estándar para otros navegadores
        doc.save(filename);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // Intentar método alternativo
      try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        Swal.fire({
          icon: 'error',
          title: 'Error al descargar PDF',
          text: 'No se pudo descargar el archivo. Intenta desde otro navegador.'
        });
      }
    }
  }

  async registerTransactions(payrollId: string) {
    const batch = this.firestore.firestore.batch();

    // Registrar impuesto a cuenta de Estudiantina
    if (this.estudiantinaAccount && this.totalTax > 0) {
      const estudiantinaTransactionRef = this.firestore.collection('financial-transactions').doc().ref;
      batch.set(estudiantinaTransactionRef, {
        accountId: this.estudiantinaAccount.id,
        type: 'deposit',
        amount: this.totalTax,
        concept: `Impuestos de nómina: ${this.contractName}`,
        balanceAfter: this.estudiantinaAccount.balance + this.totalTax,
        createdAt: new Date(),
        createdBy: this.user.uid,
        payrollId: payrollId
      });

      // Actualizar balance de Estudiantina
      const estudiantinaAccountRef = this.firestore.collection('financial-accounts').doc(this.estudiantinaAccount.id).ref;
      batch.update(estudiantinaAccountRef, {
        balance: this.estudiantinaAccount.balance + this.totalTax
      });
    }

    // Registrar pagos individuales
    for (const employee of this.allEmployees.filter(e => e.attended)) {
      // Buscar cuenta del usuario
      const accountSnapshot = await this.firestore.collection('financial-accounts', ref =>
        ref.where('userId', '==', employee.id)
      ).get().toPromise();

      if (accountSnapshot && accountSnapshot.docs.length > 0) {
        const accountDoc = accountSnapshot.docs[0];
        const accountData = accountDoc.data() as any;
        const accountId = accountDoc.id;

        const transactionRef = this.firestore.collection('financial-transactions').doc().ref;
        batch.set(transactionRef, {
          accountId: accountId,
          type: 'deposit',
          amount: employee.net,
          concept: `Pago nómina: ${this.contractName}`,
          balanceAfter: accountData.balance + employee.net,
          createdAt: new Date(),
          createdBy: this.user.uid,
          payrollId: payrollId
        });

        // Actualizar balance de usuario
        const userAccountRef = this.firestore.collection('financial-accounts').doc(accountId).ref;
        batch.update(userAccountRef, {
          balance: accountData.balance + employee.net
        });
      }
    }

    await batch.commit();

    // Enviar notificaciones push a cada empleado que recibió pago
    for (const employee of this.allEmployees.filter(e => e.attended)) {
      await this.notificationService.sendDepositNotifications(
        employee.id,
        employee.net,
        `Pago nómina: ${this.contractName}`,
        employee.name
      );
    }
  }

  generateGeneralPDF() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let yPos = 20;

    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text('NÓMINA GENERAL', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(this.contractName, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Resumen
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pago de contrato: $${this.contractAmount}`, 15, yPos);
    yPos += 6;
    doc.text(`Asistentes: ${this.attendees}`, 15, yPos);
    yPos += 6;
    doc.text(`Monto unitario: $${this.unitAmount}`, 15, yPos);
    yPos += 10;

    // Totales
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', 90, yPos);
    doc.text('BRUTO', 120, yPos);
    doc.text('IMPUESTO', 150, yPos);
    doc.text('NETO', 180, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'normal');
    doc.text(`$${this.totalGross}`, 120, yPos);
    doc.text(`$${this.totalTax}`, 150, yPos);
    doc.text(`$${this.totalNet}`, 180, yPos);
    yPos += 12;

    // Tabla
    const tableX = 10;
    const colWidths = [12, 65, 18, 18, 18, 23, 23, 23];
    let currentX = tableX;

    // Encabezados
    doc.setFillColor(24, 157, 152);
    doc.rect(tableX, yPos, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    doc.text('N.P.', currentX + 2, yPos + 5.5);
    currentX += colWidths[0];
    doc.text('Nombre', currentX + 2, yPos + 5.5);
    currentX += colWidths[1];
    doc.text('Nivel', currentX + 2, yPos + 5.5);
    currentX += colWidths[2];
    doc.text('IMP%', currentX + 2, yPos + 5.5);
    currentX += colWidths[3];
    doc.text('ASIS', currentX + 2, yPos + 5.5);
    currentX += colWidths[4];
    doc.text('BRUTO', currentX + 2, yPos + 5.5);
    currentX += colWidths[5];
    doc.text('IMP', currentX + 2, yPos + 5.5);
    currentX += colWidths[6];
    doc.text('NETO', currentX + 2, yPos + 5.5);

    yPos += 8;
    doc.setTextColor(0, 0, 0);

    // Datos
    let index = 1;
    this.allEmployees.forEach((employee) => {
      if (yPos > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(tableX, yPos, pageWidth - 20, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      currentX = tableX;
      doc.text(index.toString(), currentX + 2, yPos + 4);
      currentX += colWidths[0];
      
      const nameLines = doc.splitTextToSize(employee.name, colWidths[1] - 4);
      doc.text(nameLines[0], currentX + 2, yPos + 4);
      currentX += colWidths[1];

      doc.text(employee.level.toString(), currentX + 2, yPos + 4);
      currentX += colWidths[2];

      doc.text(`${employee.taxPercentage}%`, currentX + 2, yPos + 4);
      currentX += colWidths[3];

      doc.text(employee.attended ? '1' : '0', currentX + 2, yPos + 4);
      currentX += colWidths[4];

      doc.text(`$${employee.gross}`, currentX + 2, yPos + 4);
      currentX += colWidths[5];

      doc.text(`$${employee.tax}`, currentX + 2, yPos + 4);
      currentX += colWidths[6];

      doc.text(`$${employee.net}`, currentX + 2, yPos + 4);

      yPos += 6;
      index++;
    });

    // Footer
    yPos = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, yPos, { align: 'center' });

    // Guardar (compatible con iOS)
    this.downloadPDF(doc, `Nomina_General_${this.contractName.replace(/\s/g, '_')}_${Date.now()}.pdf`);
  }

  generateIndividualPDFs() {
    this.allEmployees.filter(e => e.attended).forEach((employee, index) => {
      setTimeout(() => {
        this.generateIndividualPDF(employee);
      }, index * 500); // Delay entre PDFs
    });
  }

  generateIndividualPDF(employee: PayrollEmployee) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let yPos = 20;

    // Encabezado
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    doc.setFontSize(14);
    doc.text('COMPROBANTE DE PAGO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Info del empleado
    doc.setFontSize(12);
    doc.text(`Integrante: ${employee.name}`, 15, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nivel: ${employee.level}`, 15, yPos);
    yPos += 6;
    doc.text(`Porcentaje de impuesto: ${employee.taxPercentage}%`, 15, yPos);
    yPos += 12;

    // Info del contrato
    doc.setFont('helvetica', 'bold');
    doc.text('Contrato:', 15, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(this.contractName, 15, yPos);
    yPos += 6;
    doc.text(`Monto total del contrato: $${this.contractAmount}`, 15, yPos);
    yPos += 6;
    doc.text(`Asistentes: ${this.attendees}`, 15, yPos);
    yPos += 6;
    doc.text(`Monto por persona: $${this.unitAmount}`, 15, yPos);
    yPos += 15;

    // Desglose
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DESGLOSE DE PAGO', 15, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Monto bruto:', 15, yPos);
    doc.text(`$${employee.gross}`, 150, yPos);
    yPos += 8;

    doc.text(`Impuesto (${employee.taxPercentage}%):`, 15, yPos);
    doc.text(`- $${employee.tax}`, 150, yPos);
    yPos += 8;

    doc.setLineWidth(0.5);
    doc.line(15, yPos, pageWidth - 15, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Monto neto a recibir:', 15, yPos);
    doc.text(`$${employee.net}`, 150, yPos);
    yPos += 15;

    // Nota
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('El impuesto se destina a la cuenta de Estudiantina Tonantzin Guadalupe', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX')}`, pageWidth / 2, yPos, { align: 'center' });

    // Footer
    yPos = doc.internal.pageSize.height - 15;
    doc.setFontSize(8);
    doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, yPos, { align: 'center' });

    // Guardar (compatible con iOS)
    this.downloadPDF(doc, `Comprobante_${employee.name.replace(/\s/g, '_')}_${Date.now()}.pdf`);
  }

  resetForm() {
    this.contractName = '';
    this.contractAmount = 0;
    this.allEmployees.forEach(e => {
      e.attended = false;
      e.gross = 0;
      e.tax = 0;
      e.net = 0;
    });
    this.attendees = 0;
    this.unitAmount = 0;
    this.totalGross = 0;
    this.totalTax = 0;
    this.totalNet = 0;
    this.currentPayrollId = null;
    this.payrollStatus = 'nuevo';
    this.lastUpdatedAt = null;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
