import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

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
  showTransportModal = false;
  selectedTransportConfig: any = null;
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
      .filter((c: any) => c.response === 'asistire')
      .reduce((total: number, c: any) => {
        return total + 1 + (parseInt(c.companions) || 0);
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
    this.showTransportModal = false;
    this.selectedTransportConfig = null;
  }

  getUnitCostFromConfig(): number {
    if (!this.selectedTransportConfig) return 0;
    const totalCost = this.selectedTransportConfig.totalCost || 0;
    const totalSeats = this.selectedTransportConfig.vehicles?.reduce((total: number, vehicle: any) => {
      return total + vehicle.occupiedSeats;
    }, 0) || 0;
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
    const mySeatsCount = this.getMySeats().length;
    const unitCost = this.getUnitCostFromConfig();
    return Math.round((mySeatsCount * unitCost) * 100) / 100;
  }
}