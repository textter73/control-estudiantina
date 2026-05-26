import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { NotificationService } from '../../services/notification.service';

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
  activeTab: string = 'open';
  
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
    requiresTransport: false,
    attire: 'ropa-normal',
    type: 'ensayo',
    status: 'abierto'
  };

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router,
    private notificationService: NotificationService
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
      // Filtrar usuarios que no están desactivados
      this.users = users.filter(user => !user.deleted);
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
      const eventRef = await this.firestore.collection('events').add(eventData);
      
      if (this.newEvent.requiresTransport) {
        await this.createTransportRequest(eventRef.id, eventData);
      }
      
      // Enviar notificaciones a todos los usuarios
      await this.sendEventNotifications(eventData);
      
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
        
        // Si el evento se cancela, notificar a todos los usuarios
        if (newStatus === 'cancelado') {
          const eventDoc = await this.firestore.collection('events').doc(eventId).get().toPromise();
          const eventData = eventDoc?.data() as any;
          if (eventData) {
            await this.sendCancellationNotifications(eventData);
          }
        }
        
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
      case 'ensayo': return 'Ensayo';
      case 'misa': return 'Misa Dominical';
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
      requiresTransport: false,
      attire: 'ropa-normal',
      type: 'ensayo',
      status: 'abierto'
    };
    this.showCreateForm = false;
  }

  viewEventDetails(eventId: string) {
    this.router.navigate(['/event-details', eventId], { queryParams: { returnUrl: '/event-management' } });
  }

  async createTransportRequest(eventId: string, eventData: any) {
    const transportRequest = {
      eventId: eventId,
      eventTitle: eventData.title,
      eventDate: eventData.date,
      eventLocation: eventData.location,
      meetingPoint: eventData.meetingPoint,
      meetingTime: eventData.meetingTime,
      startTime: eventData.startTime,
      status: 'pendiente',
      createdAt: new Date(),
      createdBy: this.user.uid,
      assignedTo: null,
      notes: ''
    };

    await this.firestore.collection('transport-requests').add(transportRequest);
  }

  // Métodos para manejar las pestañas y filtros de eventos
  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  getFilteredEvents() {
    if (this.activeTab === 'open') {
      return this.events.filter(event => event.status === 'abierto');
    } else {
      return this.events.filter(event => event.status !== 'abierto');
    }
  }

  getOpenEventsCount(): number {
    return this.events.filter(event => event.status === 'abierto').length;
  }

  getHistoricalEventsCount(): number {
    return this.events.filter(event => event.status !== 'abierto').length;
  }

  /**
   * Envía notificaciones a todos los usuarios cuando se crea un nuevo evento
   * @param eventData Datos del evento creado
   */
  async sendEventNotifications(eventData: any) {
    try {
      // Formatear la fecha del evento
      const eventDate = new Date(eventData.date);
      const formattedDate = eventDate.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        weekday: 'long'
      });

      // Formatear la hora de inicio
      const timeInfo = eventData.startTime ? ` a las ${eventData.startTime}` : '';

      // Obtener el tipo de evento
      const eventType = this.getTypeText(eventData.type);

      // Crear el mensaje de notificación
      const title = `🎉 Nuevo ${eventType}`;
      const body = `${eventData.title}\n📅 ${formattedDate}${timeInfo}\n📍 ${eventData.location || 'Por definir'}`;

      // Obtener todos los usuarios activos (no eliminados)
      const usersSnapshot = await this.firestore.collection('users').get().toPromise();

      if (usersSnapshot && !usersSnapshot.empty) {
        // Enviar notificación a cada usuario activo
        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data() as any;
          
          // Saltar usuarios eliminados
          if (userData.deleted) {
            continue;
          }
          
          await this.notificationService.sendNotificationToUser(
            userDoc.id, // Usar el ID del documento, no userData.uid
            title,
            body
          );
        }
      }
    } catch (error) {
      console.error('Error al enviar notificaciones de evento:', error);
      // Error al enviar notificaciones (no bloquea la creación del evento)
    }
  }

  /**
   * Envía notificaciones cuando se cancela un evento
   * @param eventData Datos del evento cancelado
   */
  async sendCancellationNotifications(eventData: any) {
    try {
      // Formatear la fecha del evento
      const eventDate = new Date(eventData.date);
      const formattedDate = eventDate.toLocaleDateString('es-MX', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        weekday: 'long'
      });

      // Formatear la hora de inicio
      const timeInfo = eventData.startTime ? ` que era a las ${eventData.startTime}` : '';

      // Obtener el tipo de evento
      const eventType = this.getTypeText(eventData.type);

      // Crear el mensaje de notificación
      const title = `❌ ${eventType} Cancelado`;
      const body = `${eventData.title}\n📅 ${formattedDate}${timeInfo}\nEste evento ha sido cancelado.`;

      // Obtener todos los usuarios activos (no eliminados)
      const usersSnapshot = await this.firestore.collection('users').get().toPromise();

      if (usersSnapshot && !usersSnapshot.empty) {
        // Enviar notificación a cada usuario activo
        for (const userDoc of usersSnapshot.docs) {
          const userData = userDoc.data() as any;
          
          // Saltar usuarios eliminados
          if (userData.deleted) {
            continue;
          }
          
          await this.notificationService.sendNotificationToUser(
            userDoc.id, // Usar el ID del documento, no userData.uid
            title,
            body
          );
        }
      }
    } catch (error) {
      console.error('Error al enviar notificaciones de cancelación:', error);
      // Error al enviar notificaciones (no bloquea la cancelación)
    }
  }
}