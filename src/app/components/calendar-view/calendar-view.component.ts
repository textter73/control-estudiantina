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
      
      // Intentar restaurar sesión anterior desde localStorage
      await this.restoreGoogleSession();
      
    } catch (error) {
      console.error('❌ Error inicializando Google Calendar:', error);
      this.googleCalendarEnabled = false;
    }
  }

  async restoreGoogleSession() {
    try {
      const savedToken = localStorage.getItem('google_calendar_token');
      
      if (!savedToken) {
        console.log('ℹ️ No hay sesión de Google Calendar guardada');
        return;
      }
      
      const token = JSON.parse(savedToken);
      
      // NO verificar expiración local - intentar usar el token guardado
      // Google nos avisará si el token ya no es válido
      
      // Establecer el token en GAPI
      gapi.client.setToken(token);
      
      // Verificar si el token sigue siendo válido haciendo una llamada de prueba
      console.log('🔄 Verificando token guardado...');
      
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        maxResults: 1,
        timeMin: new Date().toISOString()
      });
      
      // Si llegamos aquí, el token es válido
      this.isGoogleSignedIn = true;
      console.log('✅ Sesión de Google Calendar restaurada automáticamente');
      
      // Cargar eventos automáticamente
      await this.loadGoogleCalendarEvents();
      
    } catch (error: any) {
      console.error('❌ Error restaurando sesión de Google:', error);
      
      // Si el error es por token inválido, limpiar localStorage y pedir nueva autenticación
      if (error.status === 401 || error.status === 403) {
        console.log('🔐 Token inválido o expirado, solicitando nueva autenticación...');
        localStorage.removeItem('google_calendar_token');
        gapi.client.setToken(null);
        this.isGoogleSignedIn = false;
        
        // Solicitar nueva autenticación automáticamente de forma silenciosa
        if (this.tokenClient) {
          this.tokenClient.requestAccessToken({ prompt: '' }); // prompt: '' = sin mostrar pantalla de selección de cuenta
        }
      }
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
            
            // Guardar el token en localStorage para persistencia extendida
            const oneYearInMs = 365 * 24 * 60 * 60 * 1000; // 1 año en milisegundos
            const token = {
              access_token: response.access_token,
              expires_in: response.expires_in,
              scope: response.scope,
              token_type: response.token_type,
              expires_at: Date.now() + oneYearInMs, // Guardar con expiración de 1 año
              saved_at: Date.now()
            };
            localStorage.setItem('google_calendar_token', JSON.stringify(token));
            gapi.client.setToken(token);
            
            this.isGoogleSignedIn = true;
            console.log('✅ Usuario autenticado con Google (token guardado por 1 año)');
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
      
      // Limpiar token guardado en localStorage
      localStorage.removeItem('google_calendar_token');
      
      this.isGoogleSignedIn = false;
      
      // Recargar eventos solo de Firestore
      this.loadEvents();
      
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
      // Establecer hora al final del día para incluir eventos del último día
      endOfMonth.setHours(23, 59, 59, 999);

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
      console.log(`📆 Rango de búsqueda: ${startOfMonth.toLocaleDateString('es-MX')} - ${endOfMonth.toLocaleDateString('es-MX')}`);
      console.log(`🕐 TimeMin: ${startOfMonth.toISOString()}`);
      console.log(`🕐 TimeMax: ${endOfMonth.toISOString()}`);

      // Primero, listar los calendarios disponibles para debug
      try {
        const calendarListResponse = await gapi.client.calendar.calendarList.list();
        const calendars = calendarListResponse.result.items || [];
        console.log(`📋 Calendarios disponibles: ${calendars.length}`);
        calendars.forEach((cal: any) => {
          console.log(`  - ${cal.summary} (${cal.id}) - Primary: ${cal.primary || false}`);
        });
      } catch (calError) {
        console.warn('⚠️ No se pudo listar calendarios:', calError);
      }

      // Cargar eventos del calendario principal
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfMonth.toISOString(),
        timeMax: endOfMonth.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 250, // Aumentar el límite
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items || [];
      console.log(`📅 Eventos de Google Calendar cargados: ${googleEvents.length}`);
      
      // Debug: mostrar los primeros 3 eventos
      if (googleEvents.length > 0) {
        console.log('🔍 Primeros eventos encontrados:');
        googleEvents.slice(0, 3).forEach((event: any, index: number) => {
          console.log(`  ${index + 1}. ${event.summary} - ${event.start.date || event.start.dateTime}`);
        });
      } else {
        console.warn('⚠️ No se encontraron eventos en el rango especificado');
        console.log('💡 Sugerencia: Verifica que tengas eventos en este mes en tu Google Calendar');
      }
      
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
      
      console.log(`📊 Total de eventos (Firestore: ${firestoreEvents.length} + Google: ${convertedEvents.length}) = ${this.events.length}`);
      
      // Regenerar el calendario con los nuevos eventos
      this.generateCalendar();
      
      // Si no se encontraron eventos de Google, mostrar mensaje informativo
      if (convertedEvents.length === 0) {
        console.log('💡 Tip: Asegúrate de tener eventos en tu Google Calendar para este mes');
      }
      
    } catch (error: any) {
      console.error('❌ Error cargando eventos de Google Calendar:', error);
      
      // Proporcionar información más detallada del error
      let errorMessage = 'No se pudieron cargar los eventos de Google Calendar';
      
      if (error.status === 401 || error.status === 403) {
        errorMessage = 'Error de autenticación. Por favor, vuelve a conectar tu cuenta de Google.';
        // Limpiar token inválido
        localStorage.removeItem('google_calendar_token');
        this.isGoogleSignedIn = false;
      } else if (error.status === 404) {
        errorMessage = 'No se encontró el calendario. Verifica que tu cuenta tenga acceso a Google Calendar.';
      } else if (error.message) {
        console.error('Detalles del error:', error.message);
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Error cargando eventos',
        text: errorMessage,
        footer: 'Revisa la consola del navegador (F12) para más detalles',
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
  
  // Función de diagnóstico para debug - llamar desde consola del navegador
  async debugGoogleCalendar() {
    if (!this.isGoogleSignedIn) {
      console.error('❌ No estás conectado a Google Calendar');
      return;
    }
    
    console.log('🔍 === DIAGNÓSTICO DE GOOGLE CALENDAR ===');
    
    try {
      // 1. Listar todos los calendarios
      console.log('\n📋 1. CALENDARIOS DISPONIBLES:');
      const calListResponse = await gapi.client.calendar.calendarList.list();
      const calendars = calListResponse.result.items || [];
      calendars.forEach((cal: any) => {
        console.log(`  ${cal.primary ? '⭐' : '  '} ${cal.summary}`);
        console.log(`     ID: ${cal.id}`);
        console.log(`     Acceso: ${cal.accessRole}`);
      });
      
      // 2. Buscar eventos en un rango amplio (últimos 3 meses + próximos 3 meses)
      console.log('\n📅 2. EVENTOS EN LOS ÚLTIMOS Y PRÓXIMOS 3 MESES:');
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, 0);
      
      console.log(`   Desde: ${threeMonthsAgo.toLocaleDateString('es-MX')}`);
      console.log(`   Hasta: ${threeMonthsAhead.toLocaleDateString('es-MX')}`);
      
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: threeMonthsAgo.toISOString(),
        timeMax: threeMonthsAhead.toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 100,
        orderBy: 'startTime'
      });
      
      const events = response.result.items || [];
      console.log(`\n   Total de eventos encontrados: ${events.length}`);
      
      if (events.length > 0) {
        console.log('\n   Primeros 10 eventos:');
        events.slice(0, 10).forEach((event: any, i: number) => {
          const fecha = event.start.date || event.start.dateTime;
          console.log(`   ${i + 1}. ${event.summary} - ${fecha}`);
        });
      } else {
        console.log('   ⚠️ No se encontraron eventos en este rango');
      }
      
      // 3. Mes actual específico
      console.log(`\n📆 3. EVENTOS DEL MES ACTUAL (${this.monthNames[this.currentMonth]} ${this.currentYear}):`);
      const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
      const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);
      
      const monthResponse = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfMonth.toISOString(),
        timeMax: endOfMonth.toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const monthEvents = monthResponse.result.items || [];
      console.log(`   Eventos en este mes: ${monthEvents.length}`);
      
      if (monthEvents.length > 0) {
        monthEvents.forEach((event: any) => {
          const fecha = event.start.date || event.start.dateTime;
          console.log(`   - ${event.summary} - ${fecha}`);
        });
      }
      
      console.log('\n✅ === FIN DEL DIAGNÓSTICO ===');
      
    } catch (error) {
      console.error('❌ Error en diagnóstico:', error);
    }
  }
}
