import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-transport-management',
  templateUrl: './transport-management.component.html',
  styleUrls: ['./transport-management.component.css']
})
export class TransportManagementComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  transportRequests: any[] = [];
  events: any[] = [];
  showTransportModal = false;
  selectedRequest: any = null;
  vehicleCount = 1;
  seatsPerVehicle = 15;
  totalCost = 0;
  vehicles: any[] = [];
  selectedSeat: any = null;
  selectedPassenger: any = null;
  unassignedPassengers: any[] = [];

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
        
        if (this.canManageTransport()) {
          this.loadTransportRequests();
          this.loadEvents();
        } else {
          this.router.navigate(['/dashboard']);
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  canManageTransport(): boolean {
    return this.userProfile?.profiles?.includes('administrador') || 
           this.userProfile?.profiles?.includes('transporte') || false;
  }

  loadTransportRequests() {
    this.firestore.collection('transport-requests', ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' }).subscribe((requests: any[]) => {
        this.transportRequests = requests;
      });
  }

  async updateRequestStatus(requestId: string, newStatus: string) {
    try {
      await this.firestore.collection('transport-requests').doc(requestId).update({ 
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: this.user.uid
      });
      Swal.fire('Éxito', 'Estado actualizado', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al actualizar estado', 'error');
    }
  }

  async assignRequest(requestId: string) {
    try {
      await this.firestore.collection('transport-requests').doc(requestId).update({ 
        assignedTo: this.user.uid,
        status: 'asignado',
        updatedAt: new Date()
      });
      Swal.fire('Éxito', 'Solicitud asignada', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al asignar solicitud', 'error');
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'asignado': return 'Asignado';
      case 'guardado': return 'Guardado';
      case 'configurado': return 'Configurado';
      case 'completado': return 'Completado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pendiente': return 'status-pending';
      case 'asignado': return 'status-assigned';
      case 'guardado': return 'status-saved';
      case 'configurado': return 'status-configured';
      case 'completado': return 'status-completed';
      case 'cancelado': return 'status-cancelled';
      default: return '';
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  loadEvents() {
    this.firestore.collection('events').valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      this.events = events;
    });
  }

  getEventAttendees(eventId: string) {
    const event = this.events.find(e => e.id === eventId);
    if (!event || !event.confirmations) {
      return { attendees: 0, companions: 0, total: 0 };
    }

    const attendingConfirmations = event.confirmations.filter((c: any) => c && c.response === 'asistire');
    const attendees = attendingConfirmations.length;
    const companions = attendingConfirmations.reduce((total: number, c: any) => {
      return total + (parseInt(c?.companions) || 0);
    }, 0);

    return {
      attendees: attendees,
      companions: companions,
      total: attendees + companions
    };
  }

  getEventAttendeesList(eventId: string) {
    const event = this.events.find(e => e.id === eventId);
    if (!event || !event.confirmations) {
      return [];
    }

    return event.confirmations
      .filter((c: any) => c && c.response === 'asistire')
      .map((c: any) => ({
        userName: c?.userName || 'Usuario desconocido',
        companions: parseInt(c?.companions) || 0
      }));
  }

  getEvent(eventId: string) {
    return this.events.find(e => e.id === eventId);
  }

  manageTransport(request: any) {
    this.selectedRequest = request;
    this.loadPassengers(request.eventId);
    
    if (request.transportConfig) {
      this.loadSavedConfig(request.transportConfig);
    } else {
      this.resetToDefaults();
    }
    
    this.showTransportModal = true;
  }

  loadSavedConfig(config: any) {
    this.vehicleCount = config.vehicleCount || 1;
    this.totalCost = config.totalCost || 0;
    this.vehicles = config.vehicles || [];
    
    this.vehicles.forEach(vehicle => {
      vehicle.seats.forEach((seat: any) => {
        if (seat.occupied && seat.passenger) {
          this.unassignedPassengers = this.unassignedPassengers.filter(p => p.name !== seat.passenger.name);
        }
      });
    });
  }

  resetToDefaults() {
    this.vehicleCount = 1;
    this.totalCost = 0;
    this.vehicles = [];
    this.updateVehicles();
  }

  closeTransportModal() {
    this.showTransportModal = false;
    this.selectedRequest = null;
  }

  async copyToClipboard(request: any) {
    // Obtener la información del evento y asistentes
    const event = this.getEvent(request.eventId);
    if (!event) return;

    const attendees = this.getEventAttendeesList(request.eventId);
    const attendeesStats = this.getEventAttendees(request.eventId);
    
    // Crear el mensaje con formato bonito para WhatsApp
    let message = `🎶 *${event.title}* 🎶\n\n`;
    message += `📅 *Fecha:* ${event.date}\n`;
    message += `📍 *Lugar:* ${event.location}\n`;
    message += `🚌 *Transporte:* ${request.route}\n`;
    
    if (request.meetingPoint) {
      message += `🚩 *Punto de reunión:* ${request.meetingPoint}\n`;
    }
    if (request.meetingTime) {
      message += `🕐 *Hora:* ${request.meetingTime}\n`;
    }
    
    message += `\n👥 *Lista de Asistentes:*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    attendees.forEach((attendee: any, index: number) => {
      message += `${index + 1}. ${attendee.userName}`;
      if (attendee.companions > 0) {
        message += ` _(+${attendee.companions} acompañante${attendee.companions > 1 ? 's' : ''})_`;
      }
      message += `\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 *Resumen:*\n`;
    message += `• Integrantes: ${attendeesStats.attendees}\n`;
    message += `• Acompañantes: ${attendeesStats.companions}\n`;
    message += `• *Total: ${attendeesStats.total} personas* 🎯\n\n`;
    message += `¡Nos vemos en el evento! 🎵✨`;

    try {
      await navigator.clipboard.writeText(message);
      
      // Mostrar mensaje de éxito
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: 'El mensaje se ha copiado al portapapeles. Ahora puedes pegarlo en WhatsApp.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      // Fallback para navegadores que no soporten clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: 'El mensaje se ha copiado al portapapeles.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  }

  loadPassengers(eventId: string) {
    const attendees = this.getEventAttendeesList(eventId);
    this.unassignedPassengers = [];
    
    attendees.forEach((attendee: any) => {
      if (attendee && attendee.userName) {
        this.unassignedPassengers.push({
          name: attendee.userName,
          type: 'Integrante',
          originalAttendee: attendee
        });
        
        const companionsCount = attendee.companions || 0;
        for (let i = 0; i < companionsCount; i++) {
          this.unassignedPassengers.push({
            name: `Acompañante de ${attendee.userName} #${i + 1}`,
            type: 'Acompañante',
            originalAttendee: attendee
          });
        }
      }
    });
  }

  updateVehicles() {
    const currentVehicles = this.vehicles.length;
    
    if (this.vehicleCount > currentVehicles) {
      for (let i = currentVehicles; i < this.vehicleCount; i++) {
        this.vehicles.push(this.createVehicle(15));
      }
    } else if (this.vehicleCount < currentVehicles) {
      this.vehicles = this.vehicles.slice(0, this.vehicleCount);
    }
  }

  createVehicle(capacity: number) {
    const seats = [];
    for (let j = 0; j < capacity; j++) {
      seats.push({
        occupied: false,
        passengerName: '',
        passenger: null
      });
    }
    
    return {
      totalSeats: capacity,
      occupiedSeats: 0,
      seats: seats,
      boardingTime: '',
      departureTime: '',
      vehicleCost: 0
    };
  }

  updateVehicleSeats(vehicleIndex: number) {
    const vehicle = this.vehicles[vehicleIndex];
    const newCapacity = vehicle.totalSeats;
    const currentSeats = vehicle.seats.length;
    
    if (newCapacity > currentSeats) {
      for (let i = currentSeats; i < newCapacity; i++) {
        vehicle.seats.push({
          occupied: false,
          passengerName: '',
          passenger: null
        });
      }
    } else if (newCapacity < currentSeats) {
      const removedSeats = vehicle.seats.slice(newCapacity);
      removedSeats.forEach((seat: any) => {
        if (seat.occupied && seat.passenger) {
          this.unassignedPassengers.push(seat.passenger);
          vehicle.occupiedSeats--;
        }
      });
      vehicle.seats = vehicle.seats.slice(0, newCapacity);
    }
  }

  selectSeat(vehicleIndex: number, seatIndex: number) {
    const vehicle = this.vehicles[vehicleIndex];
    const seat = vehicle.seats[seatIndex];
    
    // Si el asiento está ocupado, liberarlo
    if (seat.occupied) {
      // Devolver el pasajero a la lista de no asignados
      if (seat.passenger) {
        this.unassignedPassengers.push(seat.passenger);
      }
      
      // Liberar el asiento
      seat.occupied = false;
      seat.passengerName = '';
      seat.passenger = null;
      vehicle.occupiedSeats--;
      
      // Limpiar selecciones
      this.selectedSeat = null;
      this.selectedPassenger = null;
      
      return;
    }
    
    // Si hay un pasajero seleccionado y el asiento está libre, asignar
    if (this.selectedPassenger && !seat.occupied) {
      seat.occupied = true;
      seat.passengerName = this.selectedPassenger.name;
      seat.passenger = this.selectedPassenger;
      vehicle.occupiedSeats++;
      
      this.unassignedPassengers = this.unassignedPassengers.filter(p => p !== this.selectedPassenger);
      this.selectedPassenger = null;
      this.selectedSeat = null;
    } else {
      // Solo seleccionar el asiento si está libre
      this.selectedSeat = { vehicleIndex, seatIndex };
    }
  }

  selectPassenger(passenger: any) {
    this.selectedPassenger = passenger;
    this.selectedSeat = null;
  }

  saveTransportConfig() {
    const transportConfig = {
      vehicleCount: this.vehicleCount,
      totalCost: this.totalCost,
      vehicles: this.vehicles,
      savedAt: new Date()
    };
    
    this.firestore.collection('transport-requests').doc(this.selectedRequest.id).update({
      transportConfig: transportConfig,
      status: 'guardado'
    }).then(() => {
      Swal.fire('Éxito', 'Configuración guardada. Puedes seguir modificando.', 'success');
      this.selectedRequest.status = 'guardado';
    }).catch(() => {
      Swal.fire('Error', 'Error al guardar configuración', 'error');
    });
  }

  finalizeTransport(requestId: string) {
    const currentRequest = this.selectedRequest;
    
    Swal.fire({
      title: '¿Finalizar transporte?',
      text: 'Una vez finalizado no podrás hacer más cambios',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.firestore.collection('transport-requests').doc(requestId).update({
          status: 'configurado',
          finalizedAt: new Date()
        }).then(() => {
          this.createTicketSales(requestId, currentRequest);
          Swal.fire('Éxito', 'Transporte finalizado y boletos creados para venta', 'success');
        }).catch(() => {
          Swal.fire('Error', 'Error al finalizar transporte', 'error');
        });
      }
    });
  }

  finalizeTransportFromModal() {
    this.finalizeTransport(this.selectedRequest.id);
    this.closeTransportModal();
  }

  getVehicleTicketPrice(vehicle: any): number {
    if (!vehicle.vehicleCost || vehicle.occupiedSeats === 0) return 0;
    return Math.round((vehicle.vehicleCost / vehicle.occupiedSeats) * 100) / 100;
  }

  getTotalTicketPrice(): number {
    const totalPeople = this.vehicles.reduce((total: number, vehicle: any) => total + vehicle.occupiedSeats, 0);
    if (totalPeople === 0) return 0;
    return Math.round((this.totalCost / totalPeople) * 100) / 100;
  }

  createTicketSales(requestId: string, request?: any) {
    const currentRequest = request || this.selectedRequest;
    
    if (!currentRequest) {
      return;
    }
    
    const tickets: any[] = [];
    
    this.vehicles.forEach((vehicle: any, vehicleIndex: number) => {
      vehicle.seats.forEach((seat: any, seatIndex: number) => {
        if (seat.occupied && seat.passenger) {
          const ticketPrice = this.getVehicleTicketPrice(vehicle) || this.getTotalTicketPrice();
          
          const ticket = {
            requestId: requestId,
            eventId: currentRequest.eventId,
            eventTitle: currentRequest.eventTitle,
            passengerName: seat.passenger.name,
            passengerType: seat.passenger.type,
            vehicleIndex: vehicleIndex + 1,
            seatNumber: seatIndex + 1,
            price: ticketPrice,
            paymentStatus: 'pendiente',
            createdAt: new Date(),
            createdBy: this.user.uid
          };
          
          tickets.push(ticket);
        }
      });
    });
    
    if (tickets.length === 0) {
      return;
    }

    // Crear colección de tickets para venta
    const batch = this.firestore.firestore.batch();
    tickets.forEach(ticket => {
      const ticketRef = this.firestore.collection('ticket-sales').doc().ref;
      batch.set(ticketRef, ticket);
    });

    batch.commit();
  }
}