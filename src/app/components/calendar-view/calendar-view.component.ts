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
declare var google: any;

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
  CLIENT_ID = '440911866333-07eplgfmhjk0bj0g3srqotf5lr21oj72.apps.googleusercontent.com';
  API_KEY = 'AIzaSyDt0DpRRKl4H-Ws0-KU_KQqQJLoiS-PQ9Y';
  DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
  SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
  tokenClient: any = null;
  gapiInited = false;
  gisInited = false;

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
    ).valueChanges({ idField: 'id' }).subscribe(async (events: any[]) => {
      this.events = events;
      
      // Si Google Calendar está conectado, cargar también esos eventos
      if (this.isGoogleSignedIn && this.googleCalendarEnabled) {
        await this.loadGoogleCalendarEvents();
      } else {
        this.generateCalendar();
      }
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
    // Si es un evento de Google Calendar, abrirlo en Google Calendar
    if (eventId.startsWith('google-')) {
      const event = this.selectedDayEvents.find(e => e.id === eventId);
      if (event && event.htmlLink) {
        window.open(event.htmlLink, '_blank');
      }
      return;
    }
    
    // Si es un evento de Firestore, navegar a los detalles
    this.router.navigate(['/event-details', eventId]);
  }

  getEventTypeClass(type: string): string {
    switch (type) {
      case 'ensayo': return 'event-ensayo';
      case 'misa': return 'event-misa';
      case 'callejoneada': return 'event-callejoneada';
      case 'evento': return 'event-evento';
      case 'participacion': return 'event-participacion';
      case 'contrato': return 'event-contrato';
      case 'google': return 'event-google';
      default: return 'event-default';
    }
  }

  getEventTypeIcon(type: string): string {
    switch (type) {
      case 'ensayo': return '🎵';
      case 'misa': return '⛪';
      case 'callejoneada': return '🎭';
      case 'evento': return '🎉';
      case 'participacion': return '🎪';
      case 'contrato': return '📋';
      case 'google': return '🔗';
      default: return '📅';
    }
  }

  // Google Calendar Integration (Nueva API GIS)
  async initGoogleCalendar() {
    try {
      // Verificar si las credenciales están configuradas
      if (!this.CLIENT_ID || !this.API_KEY) {
        console.log('⚠️ Google Calendar: Credenciales no configuradas');
        return;
      }

      // Verificar si el CLIENT_ID es válido para OAuth
      if (this.CLIENT_ID.includes('.iam.gserviceaccount.com')) {
        console.warn('⚠️ Google Calendar: CLIENT_ID es una cuenta de servicio.');
        this.googleCalendarEnabled = false;
        return;
      }

      // Verificar si la API Key tiene el formato correcto
      if (!this.API_KEY.startsWith('AIza')) {
        console.warn('⚠️ Google Calendar: API_KEY no parece ser válida.');
        this.googleCalendarEnabled = false;
        return;
      }

      console.log('🔄 Inicializando Google Calendar con nueva API GIS...');
      
      // Inicializar GAPI client
      await this.gapiLoaded();
      
      // Inicializar GIS (Google Identity Services)
      await this.gisLoaded();
      
      this.googleCalendarEnabled = true;
      console.log('✅ Google Calendar inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando Google Calendar:', error);
      this.googleCalendarEnabled = false;
    }
  }

  async gapiLoaded() {
    return new Promise<void>((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject('GAPI no cargada');
        return;
      }
      
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: this.API_KEY,
            discoveryDocs: [this.DISCOVERY_DOC]
          });
          this.gapiInited = true;
          console.log('✅ GAPI Client inicializado');
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async gisLoaded() {
    return new Promise<void>((resolve, reject) => {
      if (typeof google === 'undefined') {
        reject('Google Identity Services no cargado');
        return;
      }

      try {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.CLIENT_ID,
          scope: this.SCOPES,
          callback: (response: any) => {
            if (response.error !== undefined) {
              console.error('Error en autenticación:', response);
              this.isGoogleSignedIn = false;
              return;
            }
            this.isGoogleSignedIn = true;
            console.log('✅ Usuario autenticado con Google');
            this.loadGoogleCalendarEvents();
          }
        });
        
        this.gisInited = true;
        console.log('✅ Google Identity Services inicializado');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async signInGoogle() {
    try {
      // Verificar si CLIENT_ID es cuenta de servicio
      if (this.CLIENT_ID.includes('.iam.gserviceaccount.com')) {
        Swal.fire({
          icon: 'warning',
          title: 'OAuth 2.0 Client ID requerido',
          html: `
            <p style="text-align: left;">Tu CLIENT_ID actual es una <strong>cuenta de servicio</strong>, que no funciona para aplicaciones web.</p>
            <br>
            <p style="text-align: left;"><strong>Necesitas crear un OAuth 2.0 Client ID:</strong></p>
            <ol style="text-align: left; font-size: 14px;">
              <li>Ve a <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
              <li>Create Credentials > <strong>OAuth client ID</strong></li>
              <li>Application type: <strong>Web application</strong></li>
              <li>Authorized JavaScript origins: <code>http://localhost:4200</code></li>
              <li>Copia el Client ID (termina en .apps.googleusercontent.com)</li>
            </ol>
          `,
          confirmButtonColor: '#189d98',
          width: 600
        });
        return;
      }

      // Verificar si la API Key es válida
      if (!this.API_KEY.startsWith('AIza')) {
        Swal.fire({
          icon: 'warning',
          title: 'API Key inválida',
          html: `
            <p style="text-align: left;">Tu API_KEY actual no es válida. Las API Keys de Google empiezan con <strong>"AIza"</strong>.</p>
            <br>
            <p style="text-align: left;"><strong>Para crear una API Key:</strong></p>
            <ol style="text-align: left; font-size: 14px;">
              <li>Ve a <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a></li>
              <li>Create Credentials > <strong>API key</strong></li>
              <li>Copia la key (empieza con AIza)</li>
              <li>(Opcional) Restringir a Google Calendar API</li>
              <li>Actualiza el código con la nueva API_KEY</li>
            </ol>
          `,
          confirmButtonColor: '#189d98',
          width: 600
        });
        return;
      }

      if (!this.googleCalendarEnabled || !this.gisInited) {
        Swal.fire({
          icon: 'warning',
          title: 'Google Calendar no inicializado',
          text: 'Verifica que los scripts de Google estén cargados correctamente',
          confirmButtonColor: '#189d98'
        });
        return;
      }

      // Solicitar token usando la nueva API GIS
      this.tokenClient.requestAccessToken({ prompt: 'consent' });

    } catch (error) {
      console.error('Error conectando con Google:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar con Google Calendar. Verifica tus permisos.',
        confirmButtonColor: '#189d98'
      });
    }
  }

  async signOutGoogle() {
    try {
      // Revocar el token
      const token = gapi.client.getToken();
      if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
          console.log('Token revocado');
        });
        gapi.client.setToken(null);
      }
      
      this.isGoogleSignedIn = false;
      
      Swal.fire({
        icon: 'success',
        title: 'Desconectado',
        text: 'Tu cuenta de Google Calendar ha sido desvinculada',
        timer: 2000,
        confirmButtonColor: '#189d98'
      });
    } catch (error) {
      console.error('Error desconectando:', error);
    }
  }

  async loadGoogleCalendarEvents() {
    try {
      const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
      const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

      // Verificar si CLIENT_ID es cuenta de servicio
      if (this.CLIENT_ID.includes('.iam.gserviceaccount.com')) {
        Swal.fire({
          icon: 'info',
          title: 'Configuración pendiente',
          html: `
            <p>Para sincronizar con Google Calendar necesitas un <strong>OAuth 2.0 Client ID</strong>.</p>
            <br>
            <p>Consulta la documentación en <code>GOOGLE_CALENDAR_INTEGRATION.md</code></p>
          `,
          confirmButtonColor: '#189d98'
        });
        return;
      }

      console.log('🔄 Cargando eventos de Google Calendar...');

      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfMonth.toISOString(),
        timeMax: endOfMonth.toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items || [];
      console.log(`📅 Eventos de Google Calendar cargados: ${googleEvents.length}`);
      
      // Convertir eventos de Google al formato de la app
      const convertedEvents = googleEvents.map((event: any) => {
        // Extraer fecha del evento
        let eventDate = '';
        if (event.start.date) {
          // Evento de día completo
          eventDate = event.start.date;
        } else if (event.start.dateTime) {
          // Evento con hora específica
          eventDate = event.start.dateTime.split('T')[0];
        }

        return {
          id: `google-${event.id}`,
          title: event.summary || 'Sin título',
          description: event.description || '',
          date: eventDate,
          startTime: event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
          endTime: event.end.dateTime ? new Date(event.end.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
          location: event.location || '',
          meetingPoint: '',
          type: 'google',
          status: 'activo',
          isGoogleEvent: true,
          googleEventId: event.id,
          htmlLink: event.htmlLink
        };
      });

      console.log(`✅ Eventos de Google convertidos: ${convertedEvents.length}`);
      
      // Combinar eventos de Firestore con eventos de Google
      // Filtrar eventos de Firestore que no sean de Google
      const firestoreEvents = this.events.filter(e => !e.isGoogleEvent);
      
      // Combinar ambos arrays
      this.events = [...firestoreEvents, ...convertedEvents];
      
      console.log(`📊 Total de eventos (Firestore + Google): ${this.events.length}`);
      
      // Regenerar el calendario con los nuevos eventos
      this.generateCalendar();
      
    } catch (error) {
      console.error('❌ Error cargando eventos de Google Calendar:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error cargando eventos',
        text: 'No se pudieron cargar los eventos de Google Calendar',
        confirmButtonColor: '#189d98'
      });
    }
  }

  async syncWithGoogleCalendar() {
    if (!this.googleCalendarEnabled) {
      Swal.fire({
        icon: 'warning',
        title: 'Google Calendar no disponible',
        text: 'Asegúrate de agregar el script de Google API en index.html',
        confirmButtonColor: '#189d98'
      });
      return;
    }

    if (!this.isGoogleSignedIn) {
      const result = await Swal.fire({
        title: 'Conectar con Google Calendar',
        text: 'Necesitas conectar tu cuenta de Google para sincronizar eventos',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Conectar ahora',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#189d98'
      });

      if (result.isConfirmed) {
        await this.signInGoogle();
      }
      return;
    }

    try {
      Swal.fire({
        title: 'Sincronizando...',
        text: 'Obteniendo eventos de Google Calendar',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      await this.loadGoogleCalendarEvents();
      await this.loadEvents();
      this.generateCalendar();

      Swal.fire({
        icon: 'success',
        title: '✅ Sincronización completa',
        text: 'Los eventos de Google Calendar se han cargado correctamente',
        timer: 2000,
        confirmButtonColor: '#189d98'
      });
    } catch (error) {
      console.error('Error sincronizando:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error de sincronización',
        text: 'No se pudieron cargar los eventos de Google Calendar',
        confirmButtonColor: '#189d98'
      });
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
