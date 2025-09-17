import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-event-management',
  templateUrl: './event-management.component.html',
  styleUrls: ['./event-management.component.css']
})
export class EventManagementComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  events: any[] = [];
  users: any[] = [];
  showCreateForm = false;
  
  newEvent = {
    title: '',
    description: '',
    date: '',
    location: '',
    meetingPoint: '',
    meetingTime: '',
    startTime: '',
    endTime: '',
    hasTravelCost: false,
    travelCost: '',
    attire: 'ropa-normal',
    type: 'callejoneada',
    status: 'abierto'
  };

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
        
        if (this.canManageEvents()) {
          this.loadEvents();
          this.loadUsers();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManageEvents(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('agenda') || false;
  }

  loadEvents() {
    this.firestore.collection('events', ref => ref.orderBy('date', 'desc')).valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      this.events = events;
    });
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      this.users = users;
    });
  }

  async createEvent() {
    if (!this.newEvent.title || !this.newEvent.date) {
      Swal.fire('Error', 'Título y fecha son obligatorios', 'error');
      return;
    }

    const eventData = {
      ...this.newEvent,
      createdBy: this.user.uid,
      createdAt: new Date(),
      confirmations: []
    };

    try {
      await this.firestore.collection('events').add(eventData);
      Swal.fire('Éxito', 'Evento creado correctamente', 'success');
      this.resetForm();
    } catch (error) {
      Swal.fire('Error', 'Error al crear evento', 'error');
    }
  }

  async changeEventStatus(eventId: string, newStatus: string) {
    const result = await Swal.fire({
      title: '¿Confirmar cambio?',
      text: `¿Cambiar estado a ${newStatus}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await this.firestore.collection('events').doc(eventId).update({ status: newStatus });
        Swal.fire('Éxito', 'Estado actualizado', 'success');
      } catch (error) {
        Swal.fire('Error', 'Error al actualizar estado', 'error');
      }
    }
  }

  async deleteEvent(eventId: string) {
    const result = await Swal.fire({
      title: '¿Eliminar evento?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      try {
        await this.firestore.collection('events').doc(eventId).delete();
        Swal.fire('Eliminado', 'Evento eliminado correctamente', 'success');
      } catch (error) {
        Swal.fire('Error', 'Error al eliminar evento', 'error');
      }
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'abierto': return 'Abierto';
      case 'finalizado': return 'Finalizado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'abierto': return 'status-open';
      case 'finalizado': return 'status-finished';
      case 'cancelado': return 'status-cancelled';
      default: return '';
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

  resetForm() {
    this.newEvent = {
      title: '',
      description: '',
      date: '',
      location: '',
      meetingPoint: '',
      meetingTime: '',
      startTime: '',
      endTime: '',
      hasTravelCost: false,
      travelCost: '',
      attire: 'ropa-normal',
      type: 'callejoneada',
      status: 'abierto'
    };
    this.showCreateForm = false;
  }

  viewEventDetails(eventId: string) {
    this.router.navigate(['/event-details', eventId], { queryParams: { returnUrl: '/event-management' } });
  }
}