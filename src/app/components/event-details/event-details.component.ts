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

  // Admin: start editing a user's confirmation
  startEditConfirmation(conf: any) {
    this.editingConfirmationId = conf.userId;
    this.editSelectedResponse = conf.response;
    this.editCompanions = parseInt(conf?.companions) || 0;
  }

  // Admin: cancel editing
  cancelEdit() {
    this.editingConfirmationId = null;
    this.editSelectedResponse = '';
    this.editCompanions = 0;
  }

  // Admin: save edited confirmation (response and companions)
  async saveEditConfirmation(conf: any): Promise<void> {
    if (!this.event) {
      await Swal.fire('Error', 'Evento no cargado', 'error');
      return;
    }
    const confirmations = this.event.confirmations || [];
    const idx = confirmations.findIndex((c: any) => c && c.userId === conf.userId);
    if (idx < 0) {
      await Swal.fire('Error', 'Confirmación no encontrada', 'error');
      return;
    }

    confirmations[idx] = {
      ...confirmations[idx],
      response: this.editSelectedResponse || confirmations[idx].response,
      companions: this.event.requiresTransport ? (parseInt(this.editCompanions?.toString()) || 0) : undefined,
      // keep original timestamp and userName/userId
    };

    try {
      await this.firestore.collection('events').doc(this.eventId).update({ confirmations });
      await Swal.fire('Éxito', 'Confirmación actualizada', 'success');
      this.cancelEdit();
    } catch (error) {
      await Swal.fire('Error', 'No se pudo actualizar la confirmación', 'error');
    }
    return;
  }

  // Admin: delete a confirmation
  async deleteConfirmation(conf: any) {
    const result = await Swal.fire({
      title: 'Eliminar confirmación',
      text: `¿Eliminar la confirmación de ${conf.userName || 'este usuario'}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      const confirmations = (this.event?.confirmations || []).filter((c: any) => c && c.userId !== conf.userId);
      try {
        await this.firestore.collection('events').doc(this.eventId).update({ confirmations });
        Swal.fire('Eliminado', 'Confirmación eliminada', 'success');
      } catch (error) {
        Swal.fire('Error', 'No se pudo eliminar la confirmación', 'error');
      }
    }
  }

  // Admin: copiar respuestas y acompañantes al portapapeles en formato texto para WhatsApp

  // Admin: copiar respuestas y acompañantes al portapapeles en formato texto para WhatsApp
  async copyConfirmationsToClipboard(): Promise<void> {
    if (!this.event || !Array.isArray(this.event.confirmations)) {
      await Swal.fire('Error', 'No hay confirmaciones para copiar', 'error');
      return;
    }
      const iconMap: { [key: string]: string } = {
        'asistire': '✅',
        'tal-vez': '🤔',
        'no-asistire': '❌'
      };
      const lines = this.event.confirmations.map((c: any, idx: number) => {
        if (!c) return '';
        const name = c.userName || this.getUserName(c.userId);
        const icon = iconMap[c.response] || '';
        let line = `${idx + 1}. ${icon} ${name}`;
        if (this.event && this.event.requiresTransport && c.companions && Number(c.companions) > 0) {
          line += ` (${c.companions} acompañantes)`;
        }
        return line;
      }).filter((l: string) => l && l.length > 0);
    // Calcular totales
    const totalIntegrantes = lines.length;
    const totalAcompanantes = this.event.confirmations.reduce((sum: number, c: any) => sum + (c?.companions ? Number(c.companions) : 0), 0);
    const totalPersonas = totalIntegrantes + totalAcompanantes;
    const text = `Respuestas para el evento "${this.event.title}":\n\n` + lines.join('\n') +
      `\n\nTotal integrantes: ${totalIntegrantes}\nTotal acompañantes: ${totalAcompanantes}\nTotal personas: ${totalPersonas}`;
    try {
      await navigator.clipboard.writeText(text);
      await Swal.fire('Copiado', 'Respuestas copiadas al portapapeles', 'success');
    } catch (err) {
      await Swal.fire('Error', 'No se pudo copiar al portapapeles', 'error');
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

  // Local editing state for admin actions
  editingConfirmationId: string | null = null;
  editSelectedResponse: string = '';
  editCompanions: number = 0;



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