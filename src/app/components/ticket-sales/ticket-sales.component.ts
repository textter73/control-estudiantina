import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-ticket-sales',
  templateUrl: './ticket-sales.component.html',
  styleUrls: ['./ticket-sales.component.css']
})
export class TicketSalesComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  tickets: any[] = [];
  filteredTickets: any[] = [];
  selectedEvent: string = '';
  selectedStatus: string = 'pendiente';
  events: any[] = [];

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {}

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        if (this.canManageTickets()) {
          this.loadTickets();
          this.loadEvents();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManageTickets(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('finanzas') || false;
  }

  loadTickets() {
    this.firestore.collection('ticket-sales', ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' }).subscribe((tickets: any[]) => {
        this.tickets = tickets;
        this.applyFilters();
      });
  }

  loadEvents() {
    this.firestore.collection('events').valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      this.events = events;
    });
  }

  filterByEvent() {
    this.applyFilters();
  }

  async markAsPaid(ticketId: string) {
    try {
      await this.firestore.collection('ticket-sales').doc(ticketId).update({
        paymentStatus: 'pagado',
        paidAt: new Date(),
        paidBy: this.user.uid
      });
      Swal.fire('Éxito', 'Boleto marcado como pagado', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al actualizar estado de pago', 'error');
    }
  }

  async markAsPending(ticketId: string) {
    try {
      await this.firestore.collection('ticket-sales').doc(ticketId).update({
        paymentStatus: 'pendiente',
        paidAt: null,
        paidBy: null
      });
      Swal.fire('Éxito', 'Boleto marcado como pendiente', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al actualizar estado de pago', 'error');
    }
  }

  getPaymentStatusText(status: string): string {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'pagado': return 'Pagado';
      default: return status;
    }
  }

  getPaymentStatusClass(status: string): string {
    switch (status) {
      case 'pendiente': return 'status-pending';
      case 'pagado': return 'status-paid';
      default: return '';
    }
  }

  getTotalRevenue(): number {
    return this.filteredTickets
      .filter(ticket => ticket.paymentStatus === 'pagado')
      .reduce((total, ticket) => total + ticket.price, 0);
  }

  getPendingRevenue(): number {
    return this.filteredTickets
      .filter(ticket => ticket.paymentStatus === 'pendiente')
      .reduce((total, ticket) => total + ticket.price, 0);
  }

  filterByStatus() {
    this.applyFilters();
  }

  applyFilters() {
    let filtered = this.tickets;
    
    if (this.selectedEvent !== '') {
      filtered = filtered.filter(ticket => ticket.eventId === this.selectedEvent);
    }
    
    if (this.selectedStatus !== '') {
      filtered = filtered.filter(ticket => ticket.paymentStatus === this.selectedStatus);
    }
    
    this.filteredTickets = filtered;
  }

  getPaidTicketsCount(): number {
    return this.filteredTickets.filter(ticket => ticket.paymentStatus === 'pagado').length;
  }

  getEventDate(eventId: string): string {
    const event = this.events.find(e => e.id === eventId);
    return event?.date || '';
  }

  trackByTicketId(index: number, ticket: any): string {
    return ticket.id;
  }

  exportData() {
    Swal.fire('Info', 'Función de exportación en desarrollo', 'info');
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}