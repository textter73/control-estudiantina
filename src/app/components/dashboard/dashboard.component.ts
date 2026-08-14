import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserEvaluationService } from '../../services/user-evaluation.service';
import { InsumoService } from '../../services/insumo.service';
import { NotificationService } from '../../services/notification.service';
import { Insumo } from '../../models/insumo.model';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

// Declaración de módulo para qrcode
declare const require: any;
const QRCode = require('qrcode');

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  userLevel: {level: number, taxPercentage: number} | null = null;
  lastUserEvaluation: any = null;
  attendancePercentage: number = 0;
  totalAttendances: number = 0;
  presentAttendances: number = 0;
  participationPercentage: number = 0;
  participationAttendances: number = 0;
  activeEvents: any[] = [];
  transportRequests: any[] = [];
  ticketSales: any[] = [];
  userAccount: any = null;
  pendingPayments: any[] = [];
  myPartialPayments: any[] = [];
  showTransportModal = false;
  selectedTransportConfig: any = null;
  showMovementsModal = false;
  showRankingModal = false;
  showProfileModal = false;
  cardMovements: any[] = [];
  filteredMovements: any[] = [];
  movementFilter: string = 'all';
  
  // Modal de estado de cuenta
  showStatementModal = false;
  statementData: any = null;
  statementMovements: any[] = [];
  
  // Modal de recibo de nómina
  showReceiptModal = false;
  receiptEmployee: any = null;
  receiptPayroll: any = null;
  receiptPdfUrl: string = '';
  
  // Variables para editar perfil
  profileForm = {
    name: '',
    nickname: '',
    profileImage: '',
    birthDay: '',
    birthMonth: ''
  };
  
  months = [
    { value: '01', name: 'Enero' },
    { value: '02', name: 'Febrero' },
    { value: '03', name: 'Marzo' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Mayo' },
    { value: '06', name: 'Junio' },
    { value: '07', name: 'Julio' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Septiembre' },
    { value: '10', name: 'Octubre' },
    { value: '11', name: 'Noviembre' },
    { value: '12', name: 'Diciembre' }
  ];
  
  users: any[] = [];
  usersMap: { [key: string]: string } = {};
  
  // Usuarios con faltas consecutivas
  usersWithConsecutiveAbsences: any[] = [];
  
  // Documentos pendientes
  pendingDocuments: any[] = [];
  pendingDocumentsCount: number = 0;
  
  // Insumos con stock
  insumosConStock: Insumo[] = [];
  totalInsumosConStock: number = 0;
  insumosStockBajo: Insumo[] = [];
  insumosAgrupadosPorCategoria: { categoria: string, insumos: Insumo[], count: number, expanded: boolean }[] = [];
  
  // Notificaciones
  notificationsEnabled: boolean = false;
  
  attendanceStats = {
    presente: 0,
    escuela: 0,
    enfermedad: 0,
    falta: 0
  };

  // Nuevas estadísticas por tipo de actividad
  eventAttendanceStats = {
    percentage: 0,
    attended: 0,
    total: 0
  };

  rehearsalAttendanceStats = {
    percentage: 0,
    attended: 0,
    total: 0
  };

  massAttendanceStats = {
    percentage: 0,
    attended: 0,
    total: 0
  };

  // Estadísticas globales de asistencia
  globalAttendanceStats = {
    percentage: 0,
    attended: 0,
    total: 0
  };

  // Lista de todos los integrantes con sus estadísticas
  membersAttendanceList: any[] = [];
  rankingStartDate: Date | null = null;

  getPercentage(count: number): number {
    return this.totalAttendances > 0 ? Math.round((count / this.totalAttendances) * 100) : 0;
  }

  misaStats = {
    asistidas: 0,
    faltas: 0,
    total: 0,
    percentage: 0
  };

  get isAdmin(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || false;
  }

  get isDocumentador(): boolean {
    return this.userProfile?.profiles?.includes('documentador') || false;
  }

  get canManageInventory(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('insumos') || false;
  }

  get canRequestSupplies(): boolean {
    return true; // Todos los usuarios autenticados pueden solicitar insumos
  }

  get canManageAttendance(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('asistencia') || false;
  }

  get canManageEvents(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('agenda') || false;
  }

  get canManageTransport(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('transporte') || false;
  }

  get canManageTickets(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  get canManagePayments(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private authService: AuthService,
    private insumoService: InsumoService,
    private evaluationService: UserEvaluationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        this.loadUserLevel(user.uid); // Cargar nivel del usuario
        // Cargar última evaluación - ahora con el nombre del perfil disponible
        this.loadLastEvaluation(user.uid, this.userProfile?.name); 
        this.loadAttendanceData();
        this.loadActiveEvents();
        this.loadTransportRequests();
        this.loadTicketSales();
        this.loadUserAccount();
        this.loadUsers();
        this.loadPendingPayments();
        this.loadMyPartialPayments();
        this.loadPendingDocuments();
        this.loadInsumosData();
        this.loadAllMembersAttendance();
        this.loadUsersWithConsecutiveAbsences();
        // NOTIFICACIONES DESACTIVADAS
        // await this.checkNotificationStatus(); // Verificar estado de notificaciones
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  async loadAttendanceData() {
    if (!this.user) return;
    
    this.firestore.collection('attendance').valueChanges().subscribe((attendances: any[]) => {
      let totalCount = 0;
      let presentCount = 0;
      
      let participationCount = 0;
      const stats = { presente: 0, escuela: 0, enfermedad: 0, falta: 0 };
      
      // Contadores por tipo de actividad
      let eventTotal = 0, eventAttended = 0;
      let rehearsalTotal = 0, rehearsalAttended = 0;
      let massTotal = 0, massAttended = 0;
      
      attendances.forEach(attendance => {
        const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
        if (userRecord) {
          totalCount++;
          if (userRecord.status === 'presente') {
            presentCount++;
          }
          if (['presente', 'escuela', 'enfermedad'].includes(userRecord.status)) {
            participationCount++;
          }
          
          // Contar estadísticas por estado
          if (stats.hasOwnProperty(userRecord.status)) {
            stats[userRecord.status as keyof typeof stats]++;
          }
          
          // Contar por tipo de actividad
          const wasPresent = ['presente', 'escuela', 'enfermedad'].includes(userRecord.status);
          
          switch (attendance.type) {
            case 'evento':
              eventTotal++;
              if (wasPresent) eventAttended++;
              break;
            case 'ensayo':
              rehearsalTotal++;
              if (wasPresent) rehearsalAttended++;
              break;
            case 'misa dominical':
              massTotal++;
              if (wasPresent) massAttended++;
              break;
          }
        }
      });
      
      this.attendanceStats = stats;
      
      // Calcular estadísticas por tipo
      this.eventAttendanceStats = {
        percentage: eventTotal > 0 ? Math.round((eventAttended / eventTotal) * 100) : 0,
        attended: eventAttended,
        total: eventTotal
      };
      
      this.rehearsalAttendanceStats = {
        percentage: rehearsalTotal > 0 ? Math.round((rehearsalAttended / rehearsalTotal) * 100) : 0,
        attended: rehearsalAttended,
        total: rehearsalTotal
      };
      
      this.massAttendanceStats = {
        percentage: massTotal > 0 ? Math.round((massAttended / massTotal) * 100) : 0,
        attended: massAttended,
        total: massTotal
      };
      
      // Calcular estadísticas globales
      const globalTotal = eventTotal + rehearsalTotal + massTotal;
      const globalAttended = eventAttended + rehearsalAttended + massAttended;
      
      this.globalAttendanceStats = {
        percentage: globalTotal > 0 ? Math.round((globalAttended / globalTotal) * 100) : 0,
        attended: globalAttended,
        total: globalTotal
      };
      
      // Mantener compatibilidad con el código existente para misaStats
      this.misaStats = {
        asistidas: massAttended,
        faltas: massTotal - massAttended,
        total: massTotal,
        percentage: massTotal > 0 ? Math.round((massAttended / massTotal) * 100) : 0
      };
      
      this.totalAttendances = totalCount;
      this.presentAttendances = presentCount;
      this.participationAttendances = participationCount;
      this.attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
      this.participationPercentage = totalCount > 0 ? Math.round((participationCount / totalCount) * 100) : 0;
    });
  }

  logout() {
    this.afAuth.signOut().then(() => {
      this.router.navigate(['/']);
    });
  }

  goToTracking() {
    this.router.navigate(['/attendance-tracking']);
  }

  goToMyDocuments() {
    this.router.navigate(['/mis-documentos']);
  }

  loadActiveEvents() {
    this.firestore.collection('events').valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Resetear la hora para comparar solo fechas
      
      const activeEvents = events
        .filter(event => event.status === 'abierto')
        // .filter(event => new Date(event.date) >= today) // Solo eventos futuros o de hoy
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Más próximo primero
      
      this.activeEvents = activeEvents.map(event => {
        const userConfirmation = event.confirmations?.find((c: any) => c.userId === this.user.uid);
        return {
          ...event,
          userConfirmation: userConfirmation || null
        };
      });
    });
  }

  getConfirmationText(confirmation: any): string {
    const response = confirmation?.response || confirmation;
    if (!response) return 'Sin confirmar';
    switch (response) {
      case 'asistire': return 'Asistiré';
      case 'no-asistire': return 'No asistiré';
      case 'tal-vez': return 'Tal vez';
      default: return response;
    }
  }

  getConfirmationClass(confirmation: any): string {
    const response = confirmation?.response || confirmation;
    if (!response) return 'confirmation-pending';
    switch (response) {
      case 'asistire': return 'confirmation-yes';
      case 'no-asistire': return 'confirmation-no';
      case 'tal-vez': return 'confirmation-maybe';
      default: return 'confirmation-pending';
    }
  }

  getTypeText(type: string): string {
    switch (type) {
      case 'callejoneada': return 'Callejoneada';
      case 'evento': return 'Evento';
      case 'participacion': return 'Participación';
      case 'contrato': return 'Contrato';
      default: return type;
    }
  }

  getAttireText(attire: string): string {
    switch (attire) {
      case 'de-gala': return 'De Gala';
      case 'de-coro': return 'De Coro';
      case 'ropa-normal': return 'Ropa Normal';
      default: return attire;
    }
  }

  viewEventDetails(eventId: string) {
    this.router.navigate(['/event-details', eventId], { queryParams: { returnUrl: '/dashboard' } });
  }

  getTotalPeopleForEvent(event: any): number {
    if (!event.confirmations) return 0;
    
    return event.confirmations
      .filter((c: any) => c && c.response === 'asistire')
      .reduce((total: number, c: any) => {
        return total + 1 + (parseInt(c?.companions) || 0);
      }, 0);
  }

  loadTransportRequests() {
    this.firestore.collection('transport-requests')
      .valueChanges({ idField: 'id' }).subscribe((requests: any[]) => {
        this.transportRequests = requests;
      });
  }

  getTransportRequest(eventId: string) {
    return this.transportRequests.find(req => req.eventId === eventId);
  }

  hasTransportConfig(eventId: string): boolean {
    const request = this.getTransportRequest(eventId);
    return request && request.transportConfig && request.transportConfig.vehicles && request.transportConfig.vehicles.length > 0;
  }

  getTransportCost(eventId: string): number {
    const request = this.getTransportRequest(eventId);
    return request?.transportConfig?.totalCost || 0;
  }

  getUnitCost(eventId: string): number {
    const totalCost = this.getTransportCost(eventId);
    const totalPeople = this.getTotalPeopleForEvent(this.activeEvents.find(e => e.id === eventId));
    return totalPeople > 0 ? Math.round((totalCost / totalPeople) * 100) / 100 : 0;
  }

  viewTransportMap(eventId: string) {
    const request = this.getTransportRequest(eventId);
    if (request?.transportConfig) {
      this.selectedTransportConfig = request.transportConfig;
      this.showTransportModal = true;
    }
  }

  closeTransportModal() {
    try {
      this.showTransportModal = false;
      this.selectedTransportConfig = null;
    } catch (error) {
      console.error('Error closing transport modal:', error);
      this.showTransportModal = false;
      this.selectedTransportConfig = null;
    }
  }

  getUnitCostFromConfig(): number {
    if (!this.selectedTransportConfig?.vehicles) return 0;
    
    // Calcular costo promedio ponderado por vehículo
    let totalCost = 0;
    let totalSeats = 0;
    
    this.selectedTransportConfig.vehicles.forEach((vehicle: any) => {
      if (vehicle.occupiedSeats > 0) {
        const vehicleCost = vehicle.vehicleCost || 0;
        if (vehicleCost > 0) {
          totalCost += vehicleCost;
          totalSeats += vehicle.occupiedSeats;
        }
      }
    });
    
    // Si no hay costos individuales, usar el costo total
    if (totalCost === 0) {
      totalCost = this.selectedTransportConfig.totalCost || 0;
      totalSeats = this.selectedTransportConfig.vehicles.reduce((total: number, vehicle: any) => {
        return total + vehicle.occupiedSeats;
      }, 0);
    }
    
    return totalSeats > 0 ? Math.round((totalCost / totalSeats) * 100) / 100 : 0;
  }

  isMyseat(seat: any): boolean {
    if (!seat.occupied || !seat.passenger) return false;
    const userName = this.userProfile?.name || this.user?.email;
    return seat.passenger.name === userName || seat.passengerName === userName;
  }

  getMySeats(): any[] {
    if (!this.selectedTransportConfig?.vehicles) return [];
    
    const userName = this.userProfile?.name || this.user?.email;
    const mySeats: any[] = [];
    
    this.selectedTransportConfig.vehicles.forEach((vehicle: any, vehicleIndex: number) => {
      vehicle.seats.forEach((seat: any, seatIndex: number) => {
        if (seat.occupied && seat.passenger) {
          const isMyName = seat.passenger.name === userName || seat.passengerName === userName;
          const isMyCompanion = seat.passenger.name?.includes(`Acompañante de ${userName}`);
          
          if (isMyName || isMyCompanion) {
            mySeats.push({
              vehicleIndex,
              seatIndex,
              passengerName: seat.passenger.name || seat.passengerName,
              isCompanion: isMyCompanion
            });
          }
        }
      });
    });
    
    return mySeats;
  }

  getMyTotalCost(): number {
    if (!this.selectedTransportConfig?.vehicles) return 0;
    
    let totalCost = 0;
    const userName = this.userProfile?.name || this.user?.email;
    
    this.selectedTransportConfig.vehicles.forEach((vehicle: any) => {
      vehicle.seats.forEach((seat: any) => {
        if (seat.occupied && seat.passenger) {
          const isMyName = seat.passenger.name === userName || seat.passengerName === userName;
          const isMyCompanion = seat.passenger.name?.includes(`Acompañante de ${userName}`);
          
          if (isMyName || isMyCompanion) {
            // Usar costo individual del vehículo si está disponible
            if (vehicle.vehicleCost && vehicle.occupiedSeats > 0) {
              totalCost += vehicle.vehicleCost / vehicle.occupiedSeats;
            } else {
              // Fallback al cálculo general
              totalCost += this.getUnitCostFromConfig();
            }
          }
        }
      });
    });
    
    return Math.round(totalCost * 100) / 100;
  }

  loadTicketSales() {
    if (!this.user) return;
    
    const userName = this.userProfile?.name || this.user?.email;
    this.firestore.collection('ticket-sales').valueChanges({ idField: 'id' }).subscribe((allTickets: any[]) => {
      // Filtrar tickets propios y de acompañantes
      this.ticketSales = allTickets.filter(ticket => 
        ticket.passengerName === userName || 
        ticket.passengerName?.includes(`Acompañante de ${userName}`)
      );
    });
  }

  getMyTicketsForEvent(eventId: string): any[] {
    return this.ticketSales.filter(ticket => ticket.eventId === eventId);
  }

  getPaymentStatusForEvent(eventId: string): { status: string, total: number, paid: number } {
    const myTickets = this.getMyTicketsForEvent(eventId);
    if (myTickets.length === 0) {
      return { status: 'sin-boletos', total: 0, paid: 0 };
    }
    
    const paidTickets = myTickets.filter(ticket => ticket.paymentStatus === 'pagado');
    const total = myTickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0);
    const paid = paidTickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0);
    
    if (paidTickets.length === myTickets.length) {
      return { status: 'pagado', total, paid };
    } else if (paidTickets.length > 0) {
      return { status: 'parcial', total, paid };
    } else {
      return { status: 'pendiente', total, paid };
    }
  }

  getPaymentStatusText(status: string): string {
    switch (status) {
      case 'pagado': return 'Pagado';
      case 'parcial': return 'Pago Parcial';
      case 'pendiente': return 'Pendiente';
      case 'sin-boletos': return 'Sin Boletos';
      default: return status;
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'pagado': return 'payment-paid';
      case 'parcial': return 'payment-partial';
      case 'pendiente': return 'payment-pending';
      case 'sin-boletos': return 'payment-none';
      default: return '';
    }
  }

  loadUserAccount() {
    if (!this.user) return;
    
    this.firestore.collection('financial-accounts', ref => 
      ref.where('userId', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((accounts: any[]) => {
      this.userAccount = accounts.length > 0 ? accounts[0] : null;
    });
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges({ idField: 'id' }).subscribe((users: any[]) => {
      // Filtrar usuarios que no están desactivados
      this.users = users.filter(user => !user.deleted);
      // Crear un mapa de ID -> nombre para búsqueda rápida
      this.usersMap = {};
      this.users.forEach(user => {
        this.usersMap[user.id] = user.name || user.email || 'Usuario desconocido';
      });
    });
  }

  getUserName(userId: string): string {
    return this.usersMap[userId] || 'Usuario desconocido';
  }

  viewCardMovements() {
    if (!this.userAccount) return;
    
    this.loadCardMovements();
    this.showMovementsModal = true;
  }

  loadCardMovements() {
    if (!this.userAccount) return;
    
    // Consulta sin orderBy para evitar el error del índice
    this.firestore.collection('financial-transactions', ref => 
      ref.where('accountId', '==', this.userAccount.id)
    ).valueChanges({ idField: 'id' }).subscribe((movements: any[]) => {
      // Ordenamos en el cliente para evitar el error del índice
      this.cardMovements = movements.sort((a, b) => {
        const timestampA = a.createdAt?.toDate() || new Date(0);
        const timestampB = b.createdAt?.toDate() || new Date(0);
        return timestampB.getTime() - timestampA.getTime(); // Orden descendente
      });
      this.filterMovements();
    });
  }

  filterMovements() {
    if (this.movementFilter === 'all') {
      this.filteredMovements = this.cardMovements;
    } else {
      this.filteredMovements = this.cardMovements.filter(movement => 
        movement.type === this.movementFilter
      );
    }
  }

  onMovementFilterChange() {
    this.filterMovements();
  }

  closeMovementsModal() {
    this.showMovementsModal = false;
    this.cardMovements = [];
    this.filteredMovements = [];
    this.movementFilter = 'all';
  }

  getMovementIcon(type: string): string {
    switch (type) {
      case 'deposit': return '💰';
      case 'withdrawal': return '💸';
      default: return '💳';
    }
  }

  getMovementTypeText(type: string): string {
    switch (type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Retiro';
      default: return type;
    }
  }

  getMovementClass(type: string): string {
    switch (type) {
      case 'deposit': return 'movement-deposit';
      case 'withdrawal': return 'movement-withdrawal';
      default: return '';
    }
  }

  async downloadAccountStatement() {
    if (!this.userAccount) return;

    try {
      // Obtener movimientos de la cuenta
      const movementsSnapshot = await this.firestore.collection('financial-transactions', ref =>
        ref.where('accountId', '==', this.userAccount.id)
      ).get().toPromise();

      const movements = movementsSnapshot?.docs.map(doc => doc.data()) || [];
      const sortedMovements = movements.sort((a: any, b: any) => {
        const timestampA = a.createdAt?.toDate() || new Date(0);
        const timestampB = b.createdAt?.toDate() || new Date(0);
        return timestampB.getTime() - timestampA.getTime();
      });

      // Preparar datos para el modal de previsualización
      const currentDate = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      this.statementData = {
        account: this.userAccount,
        emissionDate: currentDate,
        status: this.userAccount.status === 'active' ? 'Activa' : 'Inactiva'
      };
      this.statementMovements = sortedMovements;
      
      // Debug: Verificar movimientos de nómina
      console.log('📊 Total de movimientos:', sortedMovements.length);
      const payrollMovements = sortedMovements.filter((m: any) => this.isPayrollTransaction(m));
      console.log('💰 Movimientos de nómina encontrados:', payrollMovements.length);
      if (payrollMovements.length > 0) {
        console.log('📝 Conceptos de nómina:', payrollMovements.map((m: any) => m.concept));
      }
      
      this.showStatementModal = true;
    } catch (error) {
      console.error('Error loading account statement:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el estado de cuenta'
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

  closeStatementModal() {
    this.showStatementModal = false;
    this.statementData = null;
    this.statementMovements = [];
  }

  closeReceiptModal() {
    // Limpiar URL del blob
    if (this.receiptPdfUrl) {
      URL.revokeObjectURL(this.receiptPdfUrl);
      this.receiptPdfUrl = '';
    }
    
    this.showReceiptModal = false;
    this.receiptEmployee = null;
    this.receiptPayroll = null;
  }

  downloadReceiptPDF() {
    if (!this.receiptEmployee || !this.receiptPayroll) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No hay datos de recibo para descargar'
      });
      return;
    }
    this.generatePayrollReceiptPDF(this.receiptEmployee, this.receiptPayroll);
  }

  downloadAsPDF() {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Encabezado
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ESTUDIANTINA TONANTZIN GUADALUPE', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      doc.setFontSize(14);
      doc.text('ESTADO DE CUENTA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.line(15, yPos, pageWidth - 15, yPos);
      yPos += 10;

      // Fecha de emisión
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha de emisión: ${this.statementData.emissionDate}`, 15, yPos);
      yPos += 10;

      // Información de la cuenta
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('INFORMACIÓN DE LA CUENTA', 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Titular: ${this.statementData.account.userName}`, 15, yPos);
      yPos += 6;
      doc.text(`Número de cuenta: ${this.statementData.account.accountNumber}`, 15, yPos);
      yPos += 6;
      doc.text(`Número de tarjeta: ${this.statementData.account.cardNumber}`, 15, yPos);
      yPos += 6;
      doc.text(`Saldo disponible: $${this.statementData.account.balance.toFixed(2)}`, 15, yPos);
      yPos += 6;
      doc.text(`Estado: ${this.statementData.status}`, 15, yPos);
      yPos += 15;

      // Movimientos - Tabla Manual
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MOVIMIENTOS', 15, yPos);
      yPos += 8;

      if (this.statementMovements.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('No hay movimientos registrados', 15, yPos);
        yPos += 10;
      } else {
        // Definir columnas de la tabla
        const tableX = 15;
        const tableWidth = pageWidth - 30;
        const col1 = tableX; // #
        const col2 = col1 + 12; // Fecha
        const col3 = col2 + 40; // Tipo
        const col4 = col3 + 25; // Concepto
        const col5 = col4 + 55; // Monto
        const col6 = col5 + 30; // Saldo
        const rowHeight = 7;

        // Función para dibujar encabezados de tabla
        const drawTableHeader = (startY: number) => {
          doc.setFillColor(24, 157, 152); // Color turquesa
          doc.rect(tableX, startY, tableWidth, 8, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          
          doc.text('#', col1 + 2, startY + 5.5);
          doc.text('Fecha', col2 + 2, startY + 5.5);
          doc.text('Tipo', col3 + 2, startY + 5.5);
          doc.text('Concepto', col4 + 2, startY + 5.5);
          doc.text('Monto', col5 + 2, startY + 5.5);
          doc.text('Saldo Después', col6 + 2, startY + 5.5);
          
          doc.setTextColor(0, 0, 0);
          return startY + 8;
        };

        // Dibujar encabezado inicial
        yPos = drawTableHeader(yPos);

        // Dibujar filas de datos
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');

        this.statementMovements.forEach((movement: any, index: number) => {
          // Verificar si necesitamos nueva página
          if (yPos > pageHeight - 35) {
            doc.addPage();
            yPos = 20;
            yPos = drawTableHeader(yPos);
          }

          const date = movement.createdAt?.toDate()?.toLocaleDateString('es-MX', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
          }) || 'N/A';
          const time = movement.createdAt?.toDate()?.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
          }) || '';
          const type = movement.type === 'deposit' ? 'DEPÓSITO' : 'RETIRO';
          const concept = movement.concept || 'Sin concepto';
          const amount = movement.type === 'deposit' ? `+$${movement.amount.toFixed(2)}` : `-$${movement.amount.toFixed(2)}`;
          const balance = movement.balanceAfter ? `$${movement.balanceAfter.toFixed(2)}` : 'N/A';

          // Fondo de fila alternado
          if (index % 2 === 0) {
            doc.setFillColor(245, 245, 245);
            doc.rect(tableX, yPos, tableWidth, rowHeight, 'F');
          }

          // Dibujar datos
          doc.setFont('helvetica', 'normal');
          doc.text((index + 1).toString(), col1 + 2, yPos + 5);
          doc.text(date, col2 + 2, yPos + 3.5);
          doc.text(time, col2 + 2, yPos + 6, { maxWidth: 35 });
          doc.text(type, col3 + 2, yPos + 5);
          
          // Concepto con límite de ancho
          const conceptLines = doc.splitTextToSize(concept, 50);
          doc.text(conceptLines[0], col4 + 2, yPos + 5);
          
          doc.text(amount, col5 + 2, yPos + 5);
          doc.text(balance, col6 + 2, yPos + 5);

          // Línea divisoria
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.line(tableX, yPos + rowHeight, tableX + tableWidth, yPos + rowHeight);

          yPos += rowHeight;
        });
        
        yPos += 5;
      }

      // Pie de página
      const finalY = yPos || 20;
      const footerY = pageHeight - 15;
      
      // Si hay espacio suficiente en la página actual, usar esa página, si no, agregar nueva
      if (finalY > pageHeight - 30) {
        doc.addPage();
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento generado automáticamente', pageWidth / 2, pageHeight - 15, { align: 'center' });
        doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, pageHeight - 11, { align: 'center' });
      } else {
        doc.setLineWidth(0.5);
        doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('Documento generado automáticamente', pageWidth / 2, footerY, { align: 'center' });
        doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, footerY + 4, { align: 'center' });
      }

      // Guardar PDF (compatible con iOS)
      const fileName = `Estado_Cuenta_${this.statementData.account.accountNumber}_${new Date().getTime()}.pdf`;
      this.downloadPDF(doc, fileName);

      Swal.fire({
        icon: 'success',
        title: '¡PDF descargado!',
        text: 'Tu estado de cuenta ha sido descargado exitosamente',
        timer: 2000,
        showConfirmButton: false
      });

      this.closeStatementModal();
    } catch (error) {
      console.error('Error generating PDF:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF. Por favor intenta nuevamente.'
      });
    }
  }

  loadPendingPayments() {
    if (!this.user) return;
    
    // Consulta simple - solo filtrar por userId primero
    this.firestore.collection('payment-notifications', ref => 
      ref.where('userId', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((allPayments: any[]) => {
      // Filtrar por status 'pending' en el cliente y ordenar por fecha
      this.pendingPayments = allPayments
        .filter(payment => payment.status === 'pending')
        .sort((a, b) => {
          const dateA = a.dueDate?.toDate() || new Date();
          const dateB = b.dueDate?.toDate() || new Date();
          return dateA.getTime() - dateB.getTime();
        });
    });
  }

  async markNotificationAsCompleted(notificationId: string) {
    try {
      const result = await Swal.fire({
        title: '¿Marcar como completada?',
        text: 'Esta notificación se marcará como completada y desaparecerá de tus pendientes',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, marcar como completada',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#16a34a'
      });

      if (result.isConfirmed) {
        await this.firestore.collection('payment-notifications').doc(notificationId).update({
          status: 'completed',
          completedAt: new Date()
        });

        Swal.fire({
          icon: 'success',
          title: '¡Notificación completada!',
          text: 'La notificación ha sido marcada como completada',
          timer: 2000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error marking notification as completed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo marcar la notificación como completada'
      });
    }
  }

  async markAsPaid(payment: any) {
    try {
      const result = await Swal.fire({
        title: '¿Confirmar pago?',
        text: `¿Has realizado el pago de $${payment.amount} para "${payment.concept}"?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, ya pagué',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#28a745'
      });

      if (result.isConfirmed) {
        // Actualizar el estado de la notificación
        await this.firestore.collection('payment-notifications').doc(payment.id).update({
          status: 'paid',
          paidAt: new Date(),
          read: true
        });

        // Crear registro de pago en una colección separada
        await this.firestore.collection('payment-confirmations').add({
          paymentRequestId: payment.paymentRequestId,
          notificationId: payment.id,
          userId: this.user.uid,
          userName: this.userProfile?.name || this.user.email,
          concept: payment.concept,
          amount: payment.amount,
          paidAt: new Date(),
          confirmedBy: this.user.uid
        });

        Swal.fire({
          icon: 'success',
          title: '¡Pago registrado!',
          text: 'Tu confirmación de pago ha sido registrada exitosamente.',
          timer: 3000,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo registrar el pago. Inténtalo de nuevo.'
      });
    }
  }

  loadMyPartialPayments() {
    if (!this.user) return;
    
    // Cargar mis pagos parciales realizados
    this.firestore.collection('partial-payments', ref => 
      ref.where('userId', '==', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((payments: any[]) => {
      // Ordenar por fecha de creación (más recientes primero)
      this.myPartialPayments = payments.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    });
  }

  loadPendingDocuments() {
    if (!this.user) return;

    // Cargar documentos pendientes donde el usuario esté en la lista de requeridos
    this.firestore.collection('documentos-fisicos', ref => 
      ref.where('esVersionActual', '==', true)
         .where('personasRequeridas', 'array-contains', this.user.uid)
    ).valueChanges({ idField: 'id' }).subscribe((docs: any[]) => {
      // Filtrar solo los documentos donde el usuario NO ha entregado su firma
      this.pendingDocuments = docs.filter(doc => 
        !doc.personasEntregadas || !doc.personasEntregadas.includes(this.user.uid)
      );
      
      this.pendingDocumentsCount = this.pendingDocuments.length;
    });
  }

  getTotalPaidByConcept(concept: string): number {
    return this.myPartialPayments
      .filter(p => p.concept === concept)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  getPaymentsByConcept(concept: string): any[] {
    return this.myPartialPayments
      .filter(p => p.concept === concept)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
  }

  getUniqueConcepts(): string[] {
    // Solo mostrar conceptos de cuotas que aún están pendientes
    const pendingConcepts = this.pendingPayments.map(p => p.concept);
    const uniquePendingConcepts = [...new Set(pendingConcepts)];
    
    // Filtrar solo los conceptos que tienen cuotas pendientes
    return uniquePendingConcepts.filter(concept => 
      this.hasPartialPaymentsForConcept(concept)
    );
  }

  hasPartialPaymentsForConcept(concept: string): boolean {
    return this.myPartialPayments.some(p => p.concept === concept);
  }

  isQuotaCompleted(concept: string): boolean {
    // Buscar si hay una cuota pendiente para este concepto
    return !this.pendingPayments.some(p => p.concept === concept);
  }

  getTotalQuotaForConcept(concept: string): number {
    // Obtener el monto total de la cuota desde las notificaciones pendientes
    const pendingPayment = this.pendingPayments.find(p => p.concept === concept);
    return pendingPayment ? pendingPayment.amount : 0;
  }

  getRemainingAmountForConcept(concept: string): number {
    const totalQuota = this.getTotalQuotaForConcept(concept);
    const totalPaid = this.getTotalPaidByConcept(concept);
    return Math.max(0, totalQuota - totalPaid);
  }

  getPaymentProgressPercentage(concept: string): number {
    const totalQuota = this.getTotalQuotaForConcept(concept);
    const totalPaid = this.getTotalPaidByConcept(concept);
    return totalQuota > 0 ? Math.round((totalPaid / totalQuota) * 100) : 0;
  }

  loadInsumosData() {
    this.insumoService.getInsumos().subscribe((insumos: Insumo[]) => {
      // Filtrar solo insumos activos con stock disponible
      this.insumosConStock = insumos.filter(insumo => 
        insumo.activo && insumo.cantidadDisponible > 0
      );
      
      this.totalInsumosConStock = this.insumosConStock.length;
      
      // Filtrar insumos con stock bajo (menos de la cantidad mínima)
      this.insumosStockBajo = this.insumosConStock.filter(insumo => 
        insumo.cantidadDisponible <= insumo.cantidadMinima
      );
      
      // Agrupar insumos por categoría
      this.agruparInsumosPorCategoria();
    });
  }
  
  agruparInsumosPorCategoria() {
    const grupos: { [key: string]: Insumo[] } = {};
    
    this.insumosConStock.forEach(insumo => {
      const categoria = insumo.categoria || 'Sin Categoría';
      if (!grupos[categoria]) {
        grupos[categoria] = [];
      }
      grupos[categoria].push(insumo);
    });
    
    this.insumosAgrupadosPorCategoria = Object.keys(grupos).map(categoria => ({
      categoria: categoria,
      insumos: grupos[categoria],
      count: grupos[categoria].length,
      expanded: false
    }));
  }
  
  toggleCategoria(categoria: any) {
    categoria.expanded = !categoria.expanded;
  }

  goToInventoryManagement() {
    this.router.navigate(['/inventory-management']);
  }

  goToSupplyRequest() {
    this.router.navigate(['/supply-request']);
  }

  loadAllMembersAttendance() {
    // Calcular fecha de inicio (10 meses atrás)
    const tenMonthsAgo = new Date();
    tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
    this.rankingStartDate = tenMonthsAgo;

    // Cargar usuarios y asistencias para calcular estadísticas de todos
    Promise.all([
      this.firestore.collection('users').get().toPromise(),
      this.firestore.collection('attendance').get().toPromise()
    ]).then(([usersSnapshot, attendanceSnapshot]) => {
      const allUsers = usersSnapshot?.docs.map(doc => ({ 
        uid: doc.id, 
        ...(doc.data() as any) 
      })) || [];
      
      // Filtrar solo usuarios activos (no eliminados) y excluir "Estudiantina Tonantzin"
      const users = allUsers.filter(user => 
        !user.deleted && 
        user.name !== 'Estudiantina Tonantzin Guadalupe' &&
        user.name !== 'estudiantina tonantzin' &&
        user.email !== 'estudiantina@tonantzin.com'
      );
      
      // Filtrar asistencias de los últimos 10 meses
      const allAttendances = attendanceSnapshot?.docs.map(doc => doc.data()) || [];
      const attendances = allAttendances.filter((attendance: any) => {
        const attendanceDate = attendance.date?.toDate ? attendance.date.toDate() : new Date(attendance.date);
        return attendanceDate >= tenMonthsAgo;
      });
      
      const memberStats = users.map(user => {
        let eventTotal = 0, eventAttended = 0;
        let rehearsalTotal = 0, rehearsalAttended = 0;
        let massTotal = 0, massAttended = 0;
        
        attendances.forEach((attendance: any) => {
          const userRecord = attendance.records?.find((record: any) => record.userId === user.uid);
          if (userRecord) {
            const wasPresent = ['presente', 'escuela', 'enfermedad'].includes(userRecord.status);
            
            switch (attendance.type) {
              case 'evento':
                eventTotal++;
                if (wasPresent) eventAttended++;
                break;
              case 'ensayo':
                rehearsalTotal++;
                if (wasPresent) rehearsalAttended++;
                break;
              case 'misa dominical':
                massTotal++;
                if (wasPresent) massAttended++;
                break;
            }
          }
        });
        
        const totalActivities = eventTotal + rehearsalTotal + massTotal;
        const totalAttended = eventAttended + rehearsalAttended + massAttended;
        
        return {
          uid: user.uid,
          name: user.name || 'Usuario sin nombre',
          eventPercentage: eventTotal > 0 ? Math.round((eventAttended / eventTotal) * 100) : 0,
          rehearsalPercentage: rehearsalTotal > 0 ? Math.round((rehearsalAttended / rehearsalTotal) * 100) : 0,
          massPercentage: massTotal > 0 ? Math.round((massAttended / massTotal) * 100) : 0,
          totalPercentage: totalActivities > 0 ? Math.round((totalAttended / totalActivities) * 100) : 0,
          eventStats: { attended: eventAttended, total: eventTotal },
          rehearsalStats: { attended: rehearsalAttended, total: rehearsalTotal },
          massStats: { attended: massAttended, total: massTotal },
          totalStats: { attended: totalAttended, total: totalActivities }
        };
      });
      
      // Ordenar de mayor a menor porcentaje total
      this.membersAttendanceList = memberStats
        .filter(member => member.totalStats.total > 0) // Solo mostrar usuarios con actividades
        .sort((a, b) => b.totalPercentage - a.totalPercentage);
    }).catch(error => {
      console.error('Error loading members attendance:', error);
    });
  }

  loadUsersWithConsecutiveAbsences() {
    Promise.all([
      this.firestore.collection('users').get().toPromise(),
      this.firestore.collection('attendance').get().toPromise()
    ]).then(([usersSnapshot, attendanceSnapshot]) => {
      const allUsers = usersSnapshot?.docs.map(doc => ({ 
        uid: doc.id, 
        ...(doc.data() as any) 
      })) || [];
      
      // Filtrar solo usuarios activos
      const users = allUsers.filter(user => 
        !user.deleted && 
        user.name !== 'Estudiantina Tonantzin Guadalupe'
      );
      
      // Obtener todas las asistencias y ordenarlas por fecha descendente (más reciente primero)
      const allAttendances = attendanceSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];
      
      console.log('Total asistencias encontradas:', allAttendances.length);
      
      const attendances = allAttendances
        .filter((att: any) => {
          // Solo filtrar asistencias completadas si el campo status existe
          // Si no existe el campo, incluir la asistencia
          return !att.status || att.status === 'completed';
        })
        .sort((a: any, b: any) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // Más reciente primero
        });
      
      console.log('Asistencias después de filtrar:', attendances.length);
      
      // Para cada usuario, contar faltas consecutivas desde la asistencia más reciente
      const usersWithAbsences: any[] = [];
      
      users.forEach(user => {
        let consecutiveAbsences = 0;
        let lastActivities: any[] = [];
        
        // Revisar las asistencias en orden (más reciente primero)
        for (const attendance of attendances) {
          const userRecord = attendance.records?.find((record: any) => record.userId === user.uid);
          
          if (userRecord) {
            const isFalta = userRecord.status === 'falta';
            
            if (isFalta) {
              consecutiveAbsences++;
              lastActivities.push({
                date: attendance.date?.toDate ? attendance.date.toDate() : new Date(attendance.date),
                type: attendance.type,
                status: 'falta'
              });
            } else {
              // Si encuentra una asistencia que no es falta, termina el conteo
              break;
            }
          }
          // Si no hay registro del usuario en esta asistencia, no se cuenta como falta
          // y se rompe la secuencia consecutiva
        }
        
        // Si tiene 3 o más faltas consecutivas, agregarlo a la lista
        if (consecutiveAbsences >= 3) {
          usersWithAbsences.push({
            uid: user.uid,
            name: user.name || 'Usuario sin nombre',
            consecutiveAbsences,
            lastActivities: lastActivities.slice(0, 5) // Máximo 5 actividades
          });
        }
      });
      
      // Ordenar por número de faltas consecutivas (de mayor a menor)
      this.usersWithConsecutiveAbsences = usersWithAbsences.sort((a, b) => 
        b.consecutiveAbsences - a.consecutiveAbsences
      );
      
      console.log('Usuarios con faltas consecutivas (3+):', this.usersWithConsecutiveAbsences);
      console.log('Total usuarios con faltas:', this.usersWithConsecutiveAbsences.length);
    }).catch(error => {
      console.error('Error loading users with consecutive absences:', error);
    });
  }

  // Métodos para el modal de ranking
  openRankingModal() {
    this.showRankingModal = true;
  }

  closeRankingModal() {
    this.showRankingModal = false;
  }

  // Métodos para el modal de perfil
  openProfileModal() {
    // Llenar el formulario con los datos actuales
    this.profileForm = {
      name: this.userProfile?.name || this.user?.email || '',
      nickname: this.userProfile?.nickname || '',
      profileImage: this.userProfile?.profileImage || '',
      birthDay: this.userProfile?.birthDay || '',
      birthMonth: this.userProfile?.birthMonth || ''
    };
    this.showProfileModal = true;
    
    // Generar QR después de que se abra el modal
    setTimeout(() => {
      this.generateQrCode();
    }, 100);
  }

  closeProfileModal() {
    this.showProfileModal = false;
  }

  async saveProfile() {
    if (!this.user) return;

    // Validación básica
    if (!this.profileForm.name.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El nombre es obligatorio'
      });
      return;
    }

    if (this.profileForm.birthDay && (!this.profileForm.birthMonth || this.profileForm.birthMonth === '')) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Si especificas el día, también debes seleccionar el mes'
      });
      return;
    }

    try {
      // Preparar los datos a guardar
      const updateData: any = {
        name: this.profileForm.name.trim(),
        nickname: this.profileForm.nickname.trim(),
        birthDay: this.profileForm.birthDay,
        birthMonth: this.profileForm.birthMonth,
        updatedAt: new Date()
      };

      // Solo incluir la imagen si existe (ya está en base64)
      if (this.profileForm.profileImage && this.profileForm.profileImage.trim()) {
        updateData.profileImage = this.profileForm.profileImage.trim();
      }

      // Actualizar el documento del usuario en Firestore
      await this.firestore.collection('users').doc(this.user.uid).update(updateData);

      // Actualizar el perfil local
      this.userProfile = {
        ...this.userProfile,
        ...updateData
      };

      Swal.fire({
        icon: 'success',
        title: 'Perfil actualizado',
        text: 'Tu información ha sido guardada correctamente',
        timer: 2000,
        showConfirmButton: false
      });

      this.closeProfileModal();
    } catch (error) {
      console.error('Error al guardar perfil:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la información'
      });
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire({
          icon: 'error',
          title: 'Tipo de archivo no válido',
          text: 'Solo se permiten imágenes (JPG, PNG, GIF, WebP)'
        });
        return;
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB en bytes
      if (file.size > maxSize) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: 'La imagen no debe superar los 5MB'
        });
        return;
      }

      // Convertir a base64
      const reader = new FileReader();
      reader.onload = (e: any) => {
        // El resultado ya es base64 (data:image/jpeg;base64,...)
        this.profileForm.profileImage = e.target.result;
        
        // Opcional: mostrar confirmación
        Swal.fire({
          icon: 'success',
          title: 'Imagen cargada',
          text: 'La imagen se ha cargado correctamente',
          timer: 1500,
          showConfirmButton: false
        });
      };
      
      reader.onerror = () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar la imagen'
        });
      };
      
      // Leer el archivo como data URL (base64)
      reader.readAsDataURL(file);
    }
  }

  // Cargar nivel e impuesto del usuario desde su perfil
  loadUserLevel(userId: string) {
    this.evaluationService.getUserLevelFromProfile(userId).subscribe(levelData => {
      this.userLevel = levelData;
    });
  }

  // Cargar la última evaluación del usuario
  loadLastEvaluation(userId: string, userName?: string) {
    this.evaluationService.getUserEvaluation(userId).subscribe(evaluation => {
      if (!evaluation && userName) {
        // Si no se encuentra por userId, intentar buscar por nombre
        this.evaluationService.getUserEvaluationByName(userName).subscribe(evalByName => {
          if (evalByName) {
            this.lastUserEvaluation = evalByName;
          }
        });
      } else if (evaluation) {
        this.lastUserEvaluation = evaluation;
      }
    });
  }

  // Obtener clase CSS para el badge del nivel
  getLevelBadgeClass(nivel: number): string {
    switch(nivel) {
      case 1: return 'level-1';
      case 2: return 'level-2';
      case 3: return 'level-3';
      case 4: return 'level-4';
      case 5: return 'level-5';
      case 6: return 'level-6';
      default: return 'level-6';
    }
  }

  // Obtener la etiqueta de texto para un valor de evaluación
  getEvaluationLevelText(value: number): string {
    switch(value) {
      case 1: return 'Básico';
      case 2: return 'Aceptable';
      case 3: return 'Bueno';
      case 4: return 'Excelente';
      default: return 'N/A';
    }
  }

  // Calcular totales por categoría
  getCantoTotal(): number {
    if (!this.lastUserEvaluation) return 0;
    const c = this.lastUserEvaluation.canto;
    return c.afinacion + c.rangoVocal + c.controlVocal + c.expresividad;
  }

  getInstrumentoTotal(): number {
    if (!this.lastUserEvaluation) return 0;
    const i = this.lastUserEvaluation.instrumento;
    return i.tecnica + i.precision + i.creatividad + i.versatilidad;
  }

  getCompromisoTotal(): number {
    if (!this.lastUserEvaluation) return 0;
    const c = this.lastUserEvaluation.compromiso;
    return c.ensayos + c.eventos + c.misas;
  }

  // Convertir Firestore Timestamp a Date
  getEvaluationDate(): Date | null {
    if (!this.lastUserEvaluation || !this.lastUserEvaluation.evaluatedAt) return null;
    
    // Si es un Timestamp de Firestore
    if (this.lastUserEvaluation.evaluatedAt.toDate) {
      return this.lastUserEvaluation.evaluatedAt.toDate();
    }
    
    // Si ya es un Date
    if (this.lastUserEvaluation.evaluatedAt instanceof Date) {
      return this.lastUserEvaluation.evaluatedAt;
    }
    
    return null;
  }

  // Verificar si un movimiento es de nómina
  isPayrollTransaction(movement: any): boolean {
    if (movement.type !== 'deposit') return false;
    if (!movement.concept) return false;
    
    // Buscar palabras clave relacionadas con nómina (con y sin acento)
    const concept = movement.concept.toLowerCase();
    return concept.includes('nómina') || 
           concept.includes('nomina') || 
           concept.includes('pago nómina') ||
           concept.includes('pago nomina');
  }

  // Ver recibo de nómina individual
  async viewPayrollReceipt(movement: any) {
    try {
      let payrollDoc: any = null;

      // Intento 1: Buscar por payrollId si existe
      if (movement.payrollId) {
        payrollDoc = await this.firestore.collection('payrolls').doc(movement.payrollId).get().toPromise();
      }

      // Intento 2: Si no hay payrollId, buscar por concepto y fecha aproximada
      if (!payrollDoc || !payrollDoc.exists) {
        console.log('🔍 Buscando nómina por concepto...');
        
        // Extraer nombre del contrato del concepto
        const conceptMatch = movement.concept.match(/(?:Pago nómina|Pago nomina):\s*(.+)/i);
        if (!conceptMatch) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo identificar el nombre del contrato en este pago'
          });
          return;
        }

        const contractName = conceptMatch[1].trim();
        console.log('📝 Contrato identificado:', contractName);

        // Buscar nómina completada con ese nombre de contrato
        const payrollsSnapshot = await this.firestore.collection('payrolls', ref =>
          ref.where('status', '==', 'completada')
             .where('contractName', '==', contractName)
        ).get().toPromise();

        if (!payrollsSnapshot || payrollsSnapshot.empty) {
          Swal.fire({
            icon: 'error',
            title: 'Nómina no encontrada',
            text: 'No se encontró la nómina asociada a este pago. Es posible que sea un pago antiguo sin registro de nómina.'
          });
          return;
        }

        // Si hay múltiples, usar la más reciente
        const payrolls = payrollsSnapshot.docs.sort((a, b) => {
          const dataA = a.data() as any;
          const dataB = b.data() as any;
          const dateA = dataA.validatedAt?.toDate() || new Date(0);
          const dateB = dataB.validatedAt?.toDate() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        payrollDoc = payrolls[0];
        console.log('✅ Nómina encontrada:', payrollDoc.id);
      }

      if (!payrollDoc || !payrollDoc.exists) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró la nómina asociada'
        });
        return;
      }

      const payrollData = payrollDoc.data() as any;
      
      // Buscar al empleado en la nómina
      const employee = payrollData.employees.find((e: any) => e.id === this.user.uid);
      
      if (!employee) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontraron tus datos en esta nómina'
        });
        return;
      }

      // Generar PDF y crear URL para previsualización
      const pdfBlob = this.generatePayrollReceiptPDFBlob(employee, payrollData);
      
      // Limpiar URL anterior si existe
      if (this.receiptPdfUrl) {
        URL.revokeObjectURL(this.receiptPdfUrl);
      }
      
      // Crear nueva URL del blob
      this.receiptPdfUrl = URL.createObjectURL(pdfBlob);
      
      // Abrir modal de previsualización
      this.receiptEmployee = employee;
      this.receiptPayroll = payrollData;
      this.showReceiptModal = true;

    } catch (error) {
      console.error('❌ Error loading payroll receipt:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el recibo de nómina'
      });
    }
  }

  // Generar PDF como Blob para previsualización
  generatePayrollReceiptPDFBlob(employee: any, payrollData: any): Blob {
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
    doc.text(payrollData.contractName, 15, yPos);
    yPos += 6;
    doc.text(`Monto total del contrato: $${payrollData.contractAmount}`, 15, yPos);
    yPos += 6;
    doc.text(`Asistentes: ${payrollData.attendees}`, 15, yPos);
    yPos += 6;
    doc.text(`Monto por persona: $${payrollData.unitAmount}`, 15, yPos);
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
    const footerY = doc.internal.pageSize.height - 15;
    doc.setFontSize(8);
    doc.text('Estudiantina Tonantzin Guadalupe', pageWidth / 2, footerY, { align: 'center' });

    // Retornar como blob
    return doc.output('blob');
  }

  // Generar y descargar PDF de recibo individual
  generatePayrollReceiptPDF(employee: any, payrollData: any) {
    const blob = this.generatePayrollReceiptPDFBlob(employee, payrollData);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_Nomina_${employee.name.replace(/\s/g, '_')}_${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Formatear montos de manera compacta (sin decimales si son .00)
  formatAmount(amount: number): string {
    if (!amount && amount !== 0) return '0';
    
    // Si el número es entero o tiene solo .00, no mostrar decimales
    if (amount % 1 === 0) {
      return amount.toLocaleString('es-MX');
    }
    
    // Si tiene decimales, mostrar 2 decimales
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  get currentDate(): Date {
    return new Date();
  }

  // Métodos para código QR
  async generateQrCode() {
    if (!this.user) return;
    
    try {
      const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      // Generar QR con el UID del usuario
      await QRCode.toCanvas(canvas, this.user.uid, {
        width: 200,
        margin: 2,
        color: {
          dark: '#189d98',
          light: '#ffffff'
        }
      });
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  }

  async downloadQrCode() {
    if (!this.user || !this.userProfile) return;

    try {
      const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      // Convertir canvas a blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const userName = this.userProfile?.name || 'usuario';
          link.download = `QR_${userName.replace(/\s/g, '_')}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);

          Swal.fire({
            icon: 'success',
            title: '✅ QR Descargado',
            text: 'Tu código QR se ha descargado correctamente',
            timer: 2000,
            showConfirmButton: false
          });
        }
      });
    } catch (error) {
      console.error('Error descargando QR:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo descargar el código QR'
      });
    }
  }

  // ========== NOTIFICACIONES PUSH ==========

  /**
   * Verifica si las notificaciones están habilitadas
   */
  async checkNotificationStatus() {
    // Verificar permiso del navegador Y estado en Firestore
    const browserPermission = this.notificationService.isNotificationEnabled();
    
    if (this.user && this.userProfile) {
      // Si el navegador tiene permiso Y el usuario lo activó en Firestore
      this.notificationsEnabled = browserPermission && (this.userProfile.notificationsEnabled || false);
      
      // Si el navegador tiene permiso pero Firestore no está sincronizado, actualizar Firestore
      if (browserPermission && !this.userProfile.notificationsEnabled) {
        try {
          const user = await this.afAuth.currentUser;
          if (user) {
            await this.firestore.collection('users').doc(user.uid).update({
              notificationsEnabled: true
            });
            this.notificationsEnabled = true;
          }
        } catch (error) {
          console.error('Error al sincronizar estado de notificaciones:', error);
        }
      }
    } else {
      this.notificationsEnabled = browserPermission;
    }
  }

  /**
   * Activa las notificaciones push
   */
  async enableNotifications() {
    const result = await this.notificationService.requestPermission();
    if (result) {
      this.notificationsEnabled = true;
      // Recargar el estado para asegurar sincronización
      await this.checkNotificationStatus();
    }
  }

  /**
   * Desactiva las notificaciones push
   */
  async disableNotifications() {
    await this.notificationService.disableNotifications();
    this.notificationsEnabled = false;
  }

  /**
   * Envía notificación de prueba con eventos del mes
   */
  async testNotification() {
    if (!this.notificationsEnabled) {
      await Swal.fire({
        icon: 'warning',
        title: 'Notificaciones desactivadas',
        text: 'Primero activa las notificaciones para recibir alertas',
        confirmButtonColor: '#189d98'
      });
      return;
    }

    await this.notificationService.getDailyEventsNotification();
  }

  /**
   * Envía notificación de prueba a todos los usuarios con notificaciones activas
   * Solo para administradores
   */
  async sendTestNotificationToAll() {
    await this.notificationService.sendTestNotificationToAll();
  }
}