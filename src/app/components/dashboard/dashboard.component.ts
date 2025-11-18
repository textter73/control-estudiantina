import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserEvaluationService } from '../../services/user-evaluation.service';
import { InsumoService } from '../../services/insumo.service';
import { Insumo } from '../../models/insumo.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  userLevel: {level: number, taxPercentage: number} | null = null;
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
  
  // Documentos pendientes
  pendingDocuments: any[] = [];
  pendingDocumentsCount: number = 0;
  
  // Insumos con stock
  insumosConStock: Insumo[] = [];
  totalInsumosConStock: number = 0;
  insumosStockBajo: Insumo[] = [];
  
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
    private evaluationService: UserEvaluationService
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        this.loadUserLevel(user.uid); // Cargar nivel del usuario
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
        .filter(event => new Date(event.date) >= today) // Solo eventos futuros o de hoy
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
      this.users = users;
      // Crear un mapa de ID -> nombre para búsqueda rápida
      this.usersMap = {};
      users.forEach(user => {
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
    });
  }

  goToInventoryManagement() {
    this.router.navigate(['/inventory-management']);
  }

  goToSupplyRequest() {
    this.router.navigate(['/supply-request']);
  }

  loadAllMembersAttendance() {
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
      
      const attendances = attendanceSnapshot?.docs.map(doc => doc.data()) || [];
      
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
}