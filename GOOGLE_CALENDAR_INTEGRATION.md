# 📅 Integración de Google Calendar con Control Estudiantina

## 🎯 Vista de Calendario Visual Implementada

Se ha creado una vista de calendario visual que muestra todos los eventos del mes de la estudiantina. El calendario incluye:

### ✅ Características Implementadas:

1. **Vista de Calendario Mensual**
   - Calendario visual con grid de 6 semanas
   - Navegación entre meses (anterior/siguiente)
   - Botón "Hoy" para regresar al mes actual
   - Indicador visual del día actual
   - Días del mes anterior/siguiente en gris

2. **Eventos en el Calendario**
   - Muestra todos los eventos del mes desde Firestore
   - Indicadores de eventos con íconos por tipo:
     - 🎭 Callejoneada (azul)
     - 🎉 Evento (morado)
     - 🎪 Participación (naranja)
     - 📋 Contrato (verde)
   - Hasta 3 eventos visibles por día
   - Indicador "+X más" si hay más de 3 eventos

3. **Detalles de Eventos**
   - Click en un día con eventos abre modal
   - Muestra todos los eventos de ese día
   - Información completa: descripción, ubicación, hora, punto de reunión
   - Botón para ver detalles completos del evento

4. **Acceso al Calendario**
   - Botón 📅 Calendario en el dashboard
   - Disponible para todos los usuarios autenticados
   - Ruta: `/calendar-view`

5. **Leyenda de Tipos de Eventos**
   - Muestra todos los tipos de eventos con sus colores

---

## 🔗 Integración con Google Calendar (Configuración Pendiente)

Para habilitar la sincronización con Google Calendar, sigue estos pasos:

### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombre sugerido: "Control Estudiantina Calendar"

### Paso 2: Habilitar Google Calendar API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Calendar API"
3. Click en **Enable** (Habilitar)

### Paso 3: Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Click en **Create Credentials** > **OAuth client ID**
3. Si es tu primera vez, configura la pantalla de consentimiento:
   - Tipo: External
   - Nombre de la aplicación: "Control Estudiantina"
   - Email de soporte: tu email
   - Logo: opcional
   - Scopes: `.../auth/calendar.readonly`
   - Usuarios de prueba: agrega emails de administradores

4. Crear OAuth Client ID:
   - Tipo de aplicación: **Web application**
   - Nombre: "Control Estudiantina Web"
   - Authorized JavaScript origins:
     - `http://localhost:4200` (para desarrollo)
     - `https://tu-dominio.com` (para producción)
   - Authorized redirect URIs:
     - `http://localhost:4200`
     - `https://tu-dominio.com`

5. Click **Create**
6. Copia el **Client ID**

### Paso 4: Crear API Key

1. En **Credentials**, click **Create Credentials** > **API Key**
2. Copia la **API Key**
3. (Opcional) Restricciones recomendadas:
   - Application restrictions: HTTP referrers
   - Agregar: `localhost:4200/*` y `tu-dominio.com/*`
   - API restrictions: Google Calendar API

### Paso 5: Configurar en la Aplicación

✅ **CONFIGURADO CORRECTAMENTE** - OAuth 2.0 Client ID agregado en: `src/app/components/calendar-view/calendar-view.component.ts`

```typescript
CLIENT_ID = '440911866333-07eplgfmhjk0bj0g3srqotf5lr21oj72.apps.googleusercontent.com'; // ✅ OAuth 2.0 Client ID
API_KEY = '115682484871491854928';
```

**Tipo de credencial:** OAuth 2.0 Client ID (válido para aplicaciones web)

### ⚠️ **IMPORTANTE - Verificar orígenes autorizados:**

Asegúrate de que en [Google Cloud Console](https://console.cloud.google.com/apis/credentials) tu OAuth 2.0 Client ID tenga configurados estos orígenes:

**Authorized JavaScript origins:**
```
http://localhost:4200
https://control-estonantzin.web.app
https://control-estonantzin.firebaseapp.com
```

**Authorized redirect URIs:**
```
http://localhost:4200
https://control-estonantzin.web.app
https://control-estonantzin.firebaseapp.com
```

### Paso 6: Agregar Google API Script

Edita `src/index.html` y agrega antes del cierre de `</body>`:

```html
<!-- Google API -->
<script src="https://apis.google.com/js/api.js"></script>
```

### Paso 7: Implementar Funciones de Sincronización

Una vez configuradas las credenciales, necesitarás implementar las siguientes funciones en el componente:

#### A. Inicialización de Google API

```typescript
async initGoogleCalendar() {
  try {
    await this.loadGapi();
    await gapi.client.init({
      apiKey: this.API_KEY,
      clientId: this.CLIENT_ID,
      discoveryDocs: [this.DISCOVERY_DOC],
      scope: this.SCOPES
    });

    // Verificar si el usuario ya está autenticado
    this.isGoogleSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    
    // Listener para cambios en el estado de autenticación
    gapi.auth2.getAuthInstance().isSignedIn.listen((signedIn: boolean) => {
      this.isGoogleSignedIn = signedIn;
      if (signedIn) {
        this.loadGoogleCalendarEvents();
      }
    });

    if (this.isGoogleSignedIn) {
      this.loadGoogleCalendarEvents();
    }
  } catch (error) {
    console.error('Error inicializando Google Calendar:', error);
  }
}

loadGapi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof gapi !== 'undefined') {
      gapi.load('client:auth2', () => resolve());
    } else {
      reject('Google API no cargada');
    }
  });
}
```

#### B. Autenticación

```typescript
async signInGoogle() {
  try {
    await gapi.auth2.getAuthInstance().signIn();
    Swal.fire({
      icon: 'success',
      title: '¡Conectado!',
      text: 'Tu cuenta de Google ha sido conectada exitosamente',
      timer: 2000
    });
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo conectar con Google Calendar'
    });
  }
}

async signOutGoogle() {
  await gapi.auth2.getAuthInstance().signOut();
  this.isGoogleSignedIn = false;
}
```

#### C. Cargar Eventos de Google Calendar

```typescript
async loadGoogleCalendarEvents() {
  try {
    const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
    const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

    const response = await gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfMonth.toISOString(),
      timeMax: endOfMonth.toISOString(),
      showDeleted: false,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const googleEvents = response.result.items || [];
    
    // Convertir eventos de Google al formato de la app
    const convertedEvents = googleEvents.map((event: any) => ({
      id: event.id,
      title: event.summary,
      description: event.description || '',
      date: event.start.date || event.start.dateTime?.split('T')[0],
      startTime: event.start.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
      endTime: event.end.dateTime ? new Date(event.end.dateTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '',
      location: event.location || '',
      type: 'evento', // Tipo por defecto para eventos de Google
      isGoogleEvent: true
    }));

    // Combinar eventos de Firestore con eventos de Google
    this.events = [...this.events, ...convertedEvents];
    this.generateCalendar();

  } catch (error) {
    console.error('Error cargando eventos de Google Calendar:', error);
  }
}
```

#### D. Actualizar el HTML

En `calendar-view.component.html`, actualiza la sección de Google Calendar:

```html
<div class="google-calendar-section">
  <div *ngIf="!isGoogleSignedIn">
    <button class="google-btn" (click)="signInGoogle()">
      <span class="google-icon">🔗</span>
      Conectar con Google Calendar
    </button>
    <small class="info-text">Ver tus eventos de Google Calendar junto a los eventos de la estudiantina</small>
  </div>

  <div *ngIf="isGoogleSignedIn">
    <button class="google-btn connected" (click)="syncWithGoogleCalendar()">
      <span class="google-icon">✅</span>
      Sincronizar Calendario
    </button>
    <button class="google-btn-secondary" (click)="signOutGoogle()">
      Desconectar
    </button>
    <small class="info-text">Google Calendar conectado</small>
  </div>
</div>
```

### Paso 8: Actualizar loadEvents()

Modifica el método `loadEvents()` para llamar también a los eventos de Google:

```typescript
loadEvents() {
  const startOfMonth = new Date(this.currentYear, this.currentMonth, 1);
  const endOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);

  // Cargar eventos de Firestore
  this.firestore.collection('events', ref => 
    ref.where('date', '>=', startOfMonth.toISOString().split('T')[0])
       .where('date', '<=', endOfMonth.toISOString().split('T')[0])
       .orderBy('date', 'asc')
  ).valueChanges({ idField: 'id' }).subscribe((events: any[]) => {
    this.events = events;
    
    // Si Google Calendar está conectado, cargar también esos eventos
    if (this.isGoogleSignedIn) {
      this.loadGoogleCalendarEvents();
    } else {
      this.generateCalendar();
    }
  });
}
```

### Paso 9: Estilos Adicionales (Opcional)

Agrega en `calendar-view.component.css`:

```css
.google-btn.connected {
  background: #34a853;
  border-color: #34a853;
  color: white;
}

.google-btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #ccc;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  margin-left: 10px;
  transition: all 0.3s ease;
}

.google-btn-secondary:hover {
  background: #f5f5f5;
}

.event-indicator.google-event {
  background: #4285f4;
  color: white;
  border-left: 3px solid #1967d2;
}
```

---

## 🎨 Diferencias Visuales entre Eventos

### Eventos de Firestore:
- 🎭 Callejoneada - Azul claro
- 🎉 Evento - Morado
- 🎪 Participación - Naranja
- 📋 Contrato - Verde

### Eventos de Google Calendar:
- 📅 Evento Google - Azul Google (#4285f4)

---

## 🔐 Seguridad y Privacidad

1. **Permisos**: Solo lectura (calendar.readonly)
2. **Datos**: Los eventos de Google solo se leen, no se modifican
3. **Privacidad**: Los eventos de Google solo son visibles para el usuario que conectó su cuenta
4. **Firestore**: Los eventos de la estudiantina siguen siendo visibles para todos

---

## 📝 Notas Importantes

1. La configuración de Google Calendar es **opcional**
2. El calendario funciona perfectamente sin Google Calendar
3. Cada usuario puede decidir si conecta su Google Calendar
4. Los eventos de la estudiantina siempre se muestran para todos
5. Los eventos de Google Calendar son personales para cada usuario

---

## 🐛 Solución de Problemas

### Error: "Origin not allowed"
- Verifica que tu dominio esté en "Authorized JavaScript origins"

### Error: "Invalid client"
- Verifica que el CLIENT_ID sea correcto
- Asegúrate de que el proyecto de Google Cloud esté activo

### Eventos de Google no aparecen
- Verifica que el usuario haya dado permiso
- Revisa la consola del navegador para errores
- Confirma que la API Key sea correcta

### Botón no aparece
- Verifica que el script de Google API esté cargado en index.html
- Revisa la consola para errores de JavaScript

---

## ✅ Checklist de Implementación

- [x] Componente calendar-view creado
- [x] Vista visual del calendario implementada
- [x] Eventos de Firestore mostrados
- [x] Modal de detalles de eventos
- [x] Botón en dashboard agregado
- [x] Ruta configurada
- [ ] Credenciales de Google Calendar configuradas
- [ ] Script de Google API agregado en index.html
- [ ] Funciones de sincronización implementadas
- [ ] Pruebas de integración realizadas

---

## 🚀 Próximos Pasos Sugeridos

1. Configurar credenciales de Google Calendar
2. Implementar las funciones de sincronización
3. Probar con usuarios reales
4. Agregar opción de exportar eventos a Google Calendar
5. Crear eventos de estudiantina desde la app y sincronizar con Google

---

¿Necesitas ayuda con algún paso específico? ¡Estoy aquí para ayudarte! 🎉
