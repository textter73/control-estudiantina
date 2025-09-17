import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-event-details',
  templateUrl: './event-details.component.html',
  styleUrls: ['./event-details.component.css']
})
export class EventDetailsComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  event: any = null;
  eventId: string = '';
  users: any[] = [];
  userConfirmation: any = null;
  selectedResponse: string = '';
  companions: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  goBack() {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      this.router.navigate([returnUrl]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  ngOnInit() {
    this.eventId = this.route.snapshot.params['id'];
    
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        this.loadEvent();
        this.loadUsers();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  loadEvent() {
    this.firestore.collection('events').doc(this.eventId).valueChanges().subscribe((event: any) => {
      this.event = event;
      if (event) {
        this.userConfirmation = event.confirmations?.find((c: any) => c && c.userId === this.user.uid);
      }
    });
  }

  loadUsers() {
    this.firestore.collection('users').valueChanges().subscribe((users: any[]) => {
      this.users = users;
    });
  }



  selectResponse(response: string) {
    this.selectedResponse = response;
    if (!this.event.requiresTransport) {
      this.submitConfirmation();
    }
  }

  async submitConfirmation() {
    const confirmation: any = {
      userId: this.user.uid,
      userName: this.userProfile?.name || this.user.email,
      response: this.selectedResponse,
      timestamp: new Date()
    };

    if (this.event.requiresTransport) {
      confirmation.companions = parseInt(this.companions.toString()) || 0;
    }

    const confirmations = this.event.confirmations || [];
    const existingIndex = confirmations.findIndex((c: any) => c && c.userId === this.user.uid);
    
    if (existingIndex >= 0) {
      confirmations[existingIndex] = confirmation;
    } else {
      confirmations.push(confirmation);
    }

    try {
      await this.firestore.collection('events').doc(this.eventId).update({ confirmations });
      Swal.fire('Éxito', 'Confirmación registrada', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error al registrar confirmación', 'error');
    }
  }

  getResponseText(response: string): string {
    switch (response) {
      case 'asistire': return 'Asistiré';
      case 'no-asistire': return 'No asistiré';
      case 'tal-vez': return 'Tal vez';
      default: return response;
    }
  }

  getResponseClass(response: string): string {
    switch (response) {
      case 'asistire': return 'response-yes';
      case 'no-asistire': return 'response-no';
      case 'tal-vez': return 'response-maybe';
      default: return '';
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

  getUserName(userId: string): string {
    const user = this.users.find(u => u.uid === userId);
    return user?.name || 'Usuario desconocido';
  }



  getConfirmationStats() {
    const confirmations = this.event?.confirmations || [];
    const asistireConfirmations = confirmations.filter((c: any) => c && c.response === 'asistire');
    
    const totalCompanions = asistireConfirmations.reduce((total: number, c: any) => {
      return total + (parseInt(c?.companions) || 0);
    }, 0);
    
    const totalPeople = asistireConfirmations.length + totalCompanions;
    
    return {
      asistire: asistireConfirmations.length,
      noAsistire: confirmations.filter((c: any) => c && c.response === 'no-asistire').length,
      talVez: confirmations.filter((c: any) => c && c.response === 'tal-vez').length,
      total: confirmations.length,
      totalCompanions: totalCompanions,
      totalPeople: totalPeople
    };
  }

  getTotalPeople(): number {
    if (!this.event?.confirmations) return 0;
    
    return this.event.confirmations
      .filter((c: any) => c && c.response === 'asistire')
      .reduce((total: number, c: any) => {
        return total + 1 + (parseInt(c?.companions) || 0);
      }, 0);
  }
}