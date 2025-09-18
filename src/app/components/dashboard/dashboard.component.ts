import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  attendancePercentage: number = 0;
  totalAttendances: number = 0;
  presentAttendances: number = 0;
  participationPercentage: number = 0;
  participationAttendances: number = 0;
  activeEvents: any[] = [];
  transportRequests: any[] = [];
  ticketSales: any[] = [];
  userAccount: any = null;
  showTransportModal = false;
  selectedTransportConfig: any = null;
  showMovementsModal = false;
  cardMovements: any[] = [];
  filteredMovements: any[] = [];
  movementFilter: string = 'all';
  users: any[] = [];
  usersMap: { [key: string]: string } = {};
  attendanceStats = {
    presente: 0,
    escuela: 0,
    enfermedad: 0,
    falta: 0
  };

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

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        this.loadAttendanceData();
        this.loadActiveEvents();
        this.loadTransportRequests();
        this.loadTicketSales();
        this.loadUserAccount();
        this.loadUsers();
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
        }
      });
      
      this.attendanceStats = stats;
      
      // Calcular estadísticas de misa dominical
      let misaAsistidas = 0;
      let misaTotal = 0;
      
      attendances.forEach(attendance => {
        if (attendance.type === 'misa dominical') {
          const userRecord = attendance.records?.find((record: any) => record.userId === this.user.uid);
          if (userRecord) {
            misaTotal++;
            if (['presente', 'escuela', 'enfermedad'].includes(userRecord.status)) {
              misaAsistidas++;
            }
          }
        }
      });
      
      this.misaStats = {
        asistidas: misaAsistidas,
        faltas: misaTotal - misaAsistidas,
        total: misaTotal,
        percentage: misaTotal > 0 ? Math.round((misaAsistidas / misaTotal) * 100) : 0
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

  loadActiveEvents() {
    this.firestore.collection('events').valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      const activeEvents = events
        .filter(event => event.status === 'abierto')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
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
}