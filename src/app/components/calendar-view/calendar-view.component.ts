import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: any[];
}

declare var gapi: any;

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.css']
})
export class CalendarViewComponent implements OnInit {
  user: any = null;
  userProfile: any = null;
  currentDate: Date = new Date();
  currentMonth: number;
  currentYear: number;
  calendarDays: CalendarDay[] = [];
  monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  events: any[] = [];
  selectedDayEvents: any[] = [];
  showEventDetails = false;
  
  // Google Calendar
  isGoogleSignedIn = false;
  googleCalendarEnabled = false;
  CLIENT_ID = '';
  API_KEY = '';
  DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
  }

  ngOnInit() {
    this.afAuth.authState.subscribe(async (user) => {
      if (user) {
        this.user = user;
        const userDoc = await this.firestore.collection('users').doc(user.uid).get().toPromise();
        this.userProfile = userDoc?.data();
        
        this.loadEvents();
        this.generateCalendar();
        this.initGoogleCalendar();
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  loadEvents() {
    // Cargar eventos del mes actual
    const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

    this.firestore.collection('events', ref => 
      ref.where('date', '>=', startOfMonth.toISOString().split('T')[0])
         .where('date', '<=', endOfMonth.toISOString().split('T')[0])
         .orderBy('date', 'asc')
    ).valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
      this.events = events;
      this.generateCalendar();
    });
  }

  generateCalendar() {
    this.calendarDays = [];
    
    // Primer día del mes
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    // Último día del mes
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    // Días del mes anterior para completar la primera semana
    const startDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
    
    // Agregar días del mes anterior
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(this.currentYear, this.currentMonth - 1, day);
      this.calendarDays.push({
        date: date,
        day: day,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }
    
    // Agregar días del mes actual
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      const dateStr = this.formatDate(date);
      const dayEvents = this.events.filter(event => event.date === dateStr);
      
      this.calendarDays.push({
        date: date,
        day: day,
        isCurrentMonth: true,
        isToday: this.isToday(date),
        events: dayEvents
      });
    }
    
    // Agregar días del mes siguiente para completar la última semana
    const remainingDays = 42 - this.calendarDays.length; // 6 semanas x 7 días
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(this.currentYear, this.currentMonth + 1, day);
      this.calendarDays.push({
        date: date,
        day: day,
        isCurrentMonth: false,
        isToday: false,
        events: []
      });
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  previousMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.loadEvents();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.loadEvents();
  }

  goToToday() {
    this.currentDate = new Date();
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
    this.loadEvents();
  }

  selectDay(calendarDay: CalendarDay) {
    if (!calendarDay.isCurrentMonth) {
      return;
    }

    if (calendarDay.events.length > 0) {
      this.selectedDayEvents = calendarDay.events;
      this.showEventDetails = true;
    }
  }

  closeEventDetails() {
    this.showEventDetails = false;
    this.selectedDayEvents = [];
  }

  viewEventDetails(eventId: string) {
    this.router.navigate(['/event-details', eventId]);
  }

  getEventTypeClass(type: string): string {
    switch (type) {
      case 'callejoneada': return 'event-callejoneada';
      case 'evento': return 'event-evento';
      case 'participacion': return 'event-participacion';
      case 'contrato': return 'event-contrato';
      default: return 'event-default';
    }
  }

  getEventTypeIcon(type: string): string {
    switch (type) {
      case 'callejoneada': return '🎭';
      case 'evento': return '🎉';
      case 'participacion': return '🎪';
      case 'contrato': return '📋';
      default: return '📅';
    }
  }

  // Google Calendar Integration
  async initGoogleCalendar() {
    try {
      // Por ahora, la integración de Google Calendar está preparada
      // pero requiere configurar CLIENT_ID y API_KEY en Firebase Console
      // Documentación: https://developers.google.com/calendar/api/quickstart/js
    } catch (error) {
      // Error inicializando Google Calendar
    }
  }

  async signInGoogle() {
    Swal.fire({
      title: 'Integración con Google Calendar',
      html: `
        <p>Para conectar tu Google Calendar necesitas:</p>
        <ol style="text-align: left;">
          <li>Ir a <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a></li>
          <li>Crear un proyecto o seleccionar uno existente</li>
          <li>Habilitar la API de Google Calendar</li>
          <li>Crear credenciales (OAuth 2.0 Client ID)</li>
          <li>Configurar las credenciales en la aplicación</li>
        </ol>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido'
    });
  }

  async syncWithGoogleCalendar() {
    Swal.fire({
      title: 'Sincronización con Google Calendar',
      text: 'Esta función estará disponible cuando configures las credenciales de Google Calendar',
      icon: 'info',
      confirmButtonText: 'Ok'
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
