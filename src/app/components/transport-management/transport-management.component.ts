import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
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
        console.log('Transport requests loaded:', requests);
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

    const attendingConfirmations = event.confirmations.filter((c: any) => c.response === 'asistire');
    const attendees = attendingConfirmations.length;
    const companions = attendingConfirmations.reduce((total: number, c: any) => {
      return total + (parseInt(c.companions) || 0);
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
      .filter((c: any) => c.response === 'asistire')
      .map((c: any) => ({
        userName: c.userName,
        companions: parseInt(c.companions) || 0
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

  loadPassengers(eventId: string) {
    const attendees = this.getEventAttendeesList(eventId);
    this.unassignedPassengers = [];
    
    attendees.forEach((attendee: any) => {
      this.unassignedPassengers.push({
        name: attendee.userName,
        type: 'Integrante',
        originalAttendee: attendee
      });
      
      for (let i = 0; i < attendee.companions; i++) {
        this.unassignedPassengers.push({
          name: `Acompañante de ${attendee.userName} #${i + 1}`,
          type: 'Acompañante',
          originalAttendee: attendee
        });
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
      seats: seats
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
    if (this.selectedPassenger) {
      const vehicle = this.vehicles[vehicleIndex];
      const seat = vehicle.seats[seatIndex];
      
      if (!seat.occupied) {
        seat.occupied = true;
        seat.passengerName = this.selectedPassenger.name;
        seat.passenger = this.selectedPassenger;
        vehicle.occupiedSeats++;
        
        this.unassignedPassengers = this.unassignedPassengers.filter(p => p !== this.selectedPassenger);
        this.selectedPassenger = null;
      }
    } else {
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
          Swal.fire('Éxito', 'Transporte finalizado correctamente', 'success');
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
}