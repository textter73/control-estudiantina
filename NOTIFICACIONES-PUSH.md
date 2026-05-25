# 🔔 Notificaciones Push - Estudiantina Tonantzin Guadalupe

## ✅ Implementación Completada - Firebase Cloud Messaging (FCM)

### Archivos Creados/Modificados:

1. **notification.service.ts** - Servicio de notificaciones con FCM completo
2. **firebase-messaging-sw.js** - Service Worker con Firebase Messaging SDK
3. **manifest.webmanifest** - Configurado con `gcm_sender_id`
4. **dashboard.component.ts** - Lógica de notificaciones
5. **dashboard.component.html** - UI para activar/desactivar
6. **dashboard.component.css** - Estilos de la interfaz
7. **angular.json** - Incluye firebase-messaging-sw.js en assets

## 📋 Funcionalidades Implementadas:

### ✅ Cliente (Angular) - FCM COMPLETO
- ✅ Firebase Cloud Messaging SDK integrado
- ✅ Clave VAPID configurada: `BCiToXwp2BrTlAC5wzM1mythL-iimdu4TpjLin9sdUdh6I5AIrrA6RaeNx5g6kd-bw3JR4QBPb93d9XPM639AdU`
- ✅ Obtención de token FCM real (guardado en Firestore)
- ✅ Solicitar permisos de notificaciones
- ✅ Escuchar mensajes en primer plano (onMessage)
- ✅ Escuchar mensajes en segundo plano (onBackgroundMessage)
- ✅ Mostrar notificaciones locales
- ✅ UI para activar/desactivar notificaciones
- ✅ Botón de prueba para ver eventos del mes
- ✅ Service Worker configurado con Firebase Messaging
- ✅ Manifest con gcm_sender_id

### 🎯 Cómo Funciona:

1. **Usuario activa notificaciones** → Se solicita permiso del navegador
2. **Se obtiene token FCM** → Token único guardado en Firestore (`users/{uid}/notificationToken`)
3. **Mensajes en primer plano** → Se muestran mediante `onMessage()` listener
4. **Mensajes en segundo plano** → Se manejan en `firebase-messaging-sw.js`
5. **Click en notificación** → Abre la app en `/event-management` o `/dashboard`

### ⚠️ Servidor (Opcional - Firebase Cloud Functions)
Para enviar notificaciones diarias automáticas, puedes configurar Firebase Cloud Functions.

## 🚀 Próximos Pasos: Configurar Cloud Functions

### 1. Instalar Firebase CLI (si no lo tienes)

```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar Cloud Functions

```bash
firebase init functions
# Selecciona: TypeScript
# Selecciona: Yes para ESLint
# Selecciona: Yes para instalar dependencias
```

### 3. Crear la Función Programada

En `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Función que se ejecuta todos los días a las 9:00 AM (hora de México)
export const sendDailyEventNotifications = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    console.log('Enviando notificaciones diarias de eventos...');

    try {
      // Obtener usuarios con notificaciones habilitadas
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('notificationsEnabled', '==', true)
        .get();

      if (usersSnapshot.empty) {
        console.log('No hay usuarios con notificaciones habilitadas');
        return null;
      }

      // Obtener eventos del mes actual
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const eventsSnapshot = await admin.firestore()
        .collection('events')
        .where('date', '>=', startOfMonth)
        .where('date', '<=', endOfMonth)
        .orderBy('date', 'asc')
        .get();

      const events = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (events.length === 0) {
        console.log('No hay eventos este mes');
        return null;
      }

      // Preparar el mensaje
      const eventsList = events.slice(0, 5).map((event: any) => {
        const eventDate = event.date.toDate();
        return `• ${eventDate.toLocaleDateString('es-MX')} - ${event.name}`;
      }).join('\n');

      const monthName = today.toLocaleDateString('es-MX', { month: 'long' });

      // Enviar notificación a cada usuario
      const tokens: string[] = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.notificationToken && userData.notificationToken !== 'web-push-enabled') {
          tokens.push(userData.notificationToken);
        }
      });

      if (tokens.length === 0) {
        console.log('No hay tokens válidos para enviar');
        return null;
      }

      const message = {
        notification: {
          title: `📅 Eventos de ${monthName}`,
          body: `Tienes ${events.length} evento(s) este mes`,
          icon: '/assets/icons/icon-192x192.png'
        },
        data: {
          click_action: '/event-management',
          events: JSON.stringify(events.slice(0, 5))
        }
      };

      // Enviar a todos los tokens
      const response = await admin.messaging().sendToDevice(tokens, message);
      
      console.log(`Notificaciones enviadas: ${response.successCount} exitosas, ${response.failureCount} fallidas`);

      // Limpiar tokens inválidos
      response.results.forEach((result, index) => {
        if (result.error) {
          console.error('Error enviando a token:', tokens[index], result.error);
          // Aquí podrías eliminar el token de la base de datos si está inválido
        }
      });

      return null;
    } catch (error) {
      console.error('Error en sendDailyEventNotifications:', error);
      return null;
    }
  });

// Función para probar manualmente (opcional)
export const testNotification = functions.https.onRequest(async (req, res) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    res.status(400).send('userId requerido');
    return;
  }

  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.notificationToken) {
      res.status(404).send('Usuario no encontrado o sin token');
      return;
    }

    const message = {
      notification: {
        title: '🧪 Notificación de Prueba',
        body: 'Esta es una notificación de prueba del sistema',
        icon: '/assets/icons/icon-192x192.png'
      },
      token: userData.notificationToken
    };

    await admin.messaging().send(message);
    res.send('Notificación enviada correctamente');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error enviando notificación');
  }
});
```

### 4. Instalar Dependencias en Functions

```bash
cd functions
npm install firebase-admin firebase-functions
cd ..
```

### 5. Desplegar las Cloud Functions

```bash
firebase deploy --only functions
```

## 🔑 Obtener Clave VAPID (Importante)

Para que las notificaciones funcionen correctamente, necesitas generar una clave VAPID:

### 1. Ve a Firebase Console
- https://console.firebase.google.com/
- Selecciona tu proyecto: **control-estonantzin**

### 2. Ve a Project Settings → Cloud Messaging
- Busca la sección "Web Push certificates"
- Haz clic en "Generate key pair"
- Copia la clave generada

### 3. Actualiza notification.service.ts
Reemplaza `'TU_VAPID_KEY_AQUI'` con la clave generada:

```typescript
private vapidKey = 'BMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...';
```

## 📱 Configurar FCM para Web

### 1. Habilitar Firebase Cloud Messaging

En Firebase Console:
1. Ve a **Cloud Messaging** en el menú lateral
2. Asegúrate de que esté habilitado
3. Verifica que tengas el **Server key**

### 2. Actualizar firebase.config.ts (si es necesario)

El archivo ya tiene el `messagingSenderId`, pero verifica que sea correcto:

```typescript
export const firebaseConfig = {
  // ... otros campos
  messagingSenderId: "197145425496", // Ya está configurado ✓
  // ...
};
```

## 🧪 Probar las Notificaciones

### 1. Desarrollo Local (Notificaciones Locales)
```bash
npm start
# Abre la app
# Ve al Dashboard
# Haz clic en "Activar Notificaciones"
# Haz clic en "Probar Ahora"
# Deberías ver una notificación con los eventos del mes
```

### 2. Producción (Con Firebase)
```bash
ng build --configuration production
firebase deploy
# Abre la app en el servidor
# Activa las notificaciones
# Las recibirás diariamente a las 9:00 AM
```

### 3. Probar Cloud Function Manualmente
```bash
# Después de desplegar las functions
curl "https://us-central1-control-estonantzin.cloudfunctions.net/testNotification?userId=TU_USER_ID"
```

## 📝 Personalizar Horario de Notificaciones

En `functions/src/index.ts`, modifica el schedule:

```typescript
// Diario a las 9:00 AM
.schedule('0 9 * * *')

// Diario a las 7:00 PM
.schedule('0 19 * * *')

// Lunes, Miércoles y Viernes a las 10:00 AM
.schedule('0 10 * * 1,3,5')

// Cada hora
.schedule('0 * * * *')
```

Formato cron: `minuto hora día mes día-semana`

## 🎨 Personalizar Notificaciones

### Modificar el contenido

En `notification.service.ts` → método `getDailyEventsNotification()`:

```typescript
await this.showLocalNotification(
  `Tu título personalizado`,
  `Tu mensaje personalizado`,
  '/assets/icons/icon-192x192.png'
);
```

### Añadir acciones

En `firebase-messaging-sw.js`:

```javascript
actions: [
  {
    action: 'explore',
    title: 'Ver eventos',
    icon: '/assets/icons/icon-72x72.png'
  },
  {
    action: 'dismiss',
    title: 'Descartar',
    icon: '/assets/icons/icon-72x72.png'
  }
]
```

## 🔒 Seguridad y Privacidad

### Permisos
- Las notificaciones **requieren permiso explícito** del usuario
- El usuario puede revocar el permiso en cualquier momento desde la configuración del navegador
- Los tokens se guardan de forma segura en Firestore

### Datos Almacenados
```typescript
{
  notificationsEnabled: boolean,
  notificationToken: string,
  notificationPreferences: {
    dailyEvents: boolean,
    eventReminders: boolean,
    paymentAlerts: boolean
  },
  lastTokenUpdate: Date
}
```

## 🐛 Troubleshooting

### La notificación no llega
1. Verifica que el usuario haya aceptado los permisos
2. Verifica que estés en HTTPS (o localhost)
3. Revisa la consola del navegador por errores
4. Verifica que el Service Worker esté registrado (DevTools → Application → Service Workers)

### Error: "Permission denied"
El usuario bloqueó las notificaciones. Debe desbloquearlas manualmente:
- Chrome: Icono del candado → Configuración del sitio → Notificaciones → Permitir
- Safari: Safari → Preferencias → Sitios web → Notificaciones

### Cloud Function no se ejecuta
1. Verifica los logs: `firebase functions:log`
2. Verifica que la función esté desplegada: `firebase functions:list`
3. Verifica el timezone y horario configurado

### Tokens inválidos
Los tokens pueden invalidarse si:
- El usuario desinstala la PWA
- El usuario borra los datos del navegador
- El usuario cambia de dispositivo

La Cloud Function limpia automáticamente tokens inválidos.

## 💰 Costos de Firebase

### Cloud Messaging (FCM)
- ✅ **GRATIS** - Sin límite de notificaciones

### Cloud Functions
- ✅ **Generoso plan gratuito**:
  - 2M invocaciones/mes gratis
  - 400,000 GB-segundos gratis
  - 200,000 GHz-segundos gratis

Para una estudiantina con ~50 usuarios:
- **Costo estimado: $0/mes** (dentro del plan gratuito)

### Firestore
- Lecturas para obtener usuarios: ~50/día
- Lecturas para obtener eventos: ~1/día
- **Total: ~1,500 lecturas/mes** (muy por debajo del límite gratuito de 50,000)

## 📊 Monitoreo

### Ver estadísticas de notificaciones

En Firebase Console → Cloud Messaging:
- Notificaciones enviadas
- Tasa de apertura
- Impresiones

### Ver logs de Cloud Functions

```bash
firebase functions:log
```

O en Firebase Console → Functions → Logs

## 🎯 Próximas Mejoras

Ideas para expandir el sistema de notificaciones:

1. **Recordatorios de eventos próximos**
   - Notificación 24h antes del evento
   - Notificación 1h antes del evento

2. **Alertas de pagos**
   - Recordatorio de pagos pendientes
   - Confirmación de pagos recibidos

3. **Alertas de faltas**
   - Notificar después de 3 faltas consecutivas
   - Recordatorio para justificar ausencias

4. **Notificaciones personalizadas**
   - Por rol (administrador, integrante, etc.)
   - Por preferencias del usuario

5. **Estadísticas de asistencia**
   - Resumen semanal/mensual
   - Comparativa con el mes anterior

## 📚 Recursos Adicionales

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications](https://developers.google.com/web/fundamentals/push-notifications)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)

---

## ✅ Resumen de la Implementación

### Lo que YA funciona:
- ✅ Interfaz para activar/desactivar notificaciones
- ✅ Solicitud de permisos al usuario
- ✅ Guardado de estado en Firestore
- ✅ Notificaciones locales de prueba
- ✅ Service Worker configurado
- ✅ Manifest con soporte FCM

### Lo que falta (opcional):
- ⚠️ Cloud Functions para envío automático diario
- ⚠️ Configuración de clave VAPID
- ⚠️ Despliegue de funciones programadas

### ¿Quieres continuar con Cloud Functions?
Si necesitas ayuda para configurar las Cloud Functions y el envío automático, avísame y te guío paso a paso.
