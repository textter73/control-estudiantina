# 🔔 Sistema de Recordatorios Automáticos para Eventos

## 📋 Implementación de Notificaciones Programadas

Este documento explica cómo implementar un sistema de recordatorios automáticos que envíe notificaciones push a los usuarios antes de los eventos (ensayos, misas, etc.).

---

## 🎯 Características Implementadas

### ✅ Notificaciones Actuales:
1. **Creación de Evento** - Notifica a todos cuando se crea un evento nuevo
2. **Cancelación de Evento** - Notifica a todos cuando se cancela un evento
3. **Asistencia Registrada** - Notifica a cada usuario cuando se registra su asistencia
4. **Pagos** - Notifica depósitos, retiros, pagos parciales y completos

---

## 🚀 Sistema de Recordatorios Automáticos

Para implementar recordatorios que se envíen automáticamente antes de los eventos, necesitas usar **Firebase Cloud Functions**.

### 📌 Opciones de Implementación:

#### **Opción 1: Cloud Functions (Recomendado)**

Las Cloud Functions se ejecutan en el servidor de Firebase y pueden programarse para revisar eventos próximos y enviar notificaciones.

**Ventajas:**
- ✅ Totalmente automático
- ✅ No depende de que la app esté abierta
- ✅ Escalable y confiable
- ✅ Se ejecuta en la nube

**Desventajas:**
- ❌ Requiere plan Blaze de Firebase (pago)
- ❌ Configuración más compleja

#### **Opción 2: Servicio Externo (Alternativa)**

Usar un servicio como Zapier, n8n o Make para revisar Firestore periódicamente.

**Ventajas:**
- ✅ No requiere código
- ✅ Fácil de configurar

**Desventajas:**
- ❌ Costo adicional del servicio
- ❌ Menos control

---

## 🛠️ Implementación con Cloud Functions

### Paso 1: Habilitar Billing en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto "control-estonantzin"
3. En el menú lateral, ve a **Spark** (plan actual)
4. Click en **Upgrade** y selecciona el plan **Blaze**
5. Configura un límite de gasto (ej: $10/mes) para evitar cargos inesperados

> **Nota:** El plan Blaze incluye una cuota gratuita generosa. Solo pagas si excedes esa cuota.

### Paso 2: Instalar Firebase CLI

Abre PowerShell y ejecuta:

```bash
npm install -g firebase-tools
```

Inicia sesión:

```bash
firebase login
```

### Paso 3: Inicializar Cloud Functions

En la carpeta de tu proyecto:

```bash
cd C:\Users\jortiz\Desktop\PROJECT\control-estudiantina
firebase init functions
```

Selecciona:
- Use an existing project: control-estonantzin
- Language: TypeScript
- ESLint: Yes
- Install dependencies: Yes

### Paso 4: Crear Función de Recordatorios

Edita `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Función que se ejecuta cada hora
export const sendEventReminders = functions.pubsub
  .schedule('0 * * * *') // Cada hora
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const now = new Date();
    
    // Revisar eventos en las próximas 24 horas
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Obtener eventos de mañana que no estén cancelados
    const eventsSnapshot = await admin.firestore()
      .collection('events')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'abierto')
      .get();

    if (eventsSnapshot.empty) {
      console.log('No hay eventos para mañana');
      return null;
    }

    // Por cada evento, enviar notificación
    const promises: Promise<any>[] = [];
    
    eventsSnapshot.forEach(eventDoc => {
      const event = eventDoc.data();
      const eventId = eventDoc.id;
      
      // Revisar si ya se envió recordatorio
      const reminderSentField = `reminder24h_${eventId}`;
      
      admin.firestore().collection('reminder-log').doc(eventId).get()
        .then(async (logDoc) => {
          const logData = logDoc.data();
          
          // Si ya se envió el recordatorio de 24h, saltar
          if (logData && logData.sent24h) {
            console.log(`Recordatorio 24h ya enviado para evento ${eventId}`);
            return;
          }
          
          // Enviar notificaciones a todos los usuarios
          const usersSnapshot = await admin.firestore()
            .collection('users')
            .where('deleted', '==', false)
            .get();
          
          const notificationPromises: Promise<any>[] = [];
          
          usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            
            if (userData.notificationsEnabled && userData.notificationToken) {
              const title = `🔔 Recordatorio: ${getEventTypeText(event.type)}`;
              const body = `Mañana - ${event.title}\n⏰ ${event.startTime || 'Hora por confirmar'}\n📍 ${event.location || 'Lugar por confirmar'}`;
              
              // Enviar notificación push
              const message = {
                token: userData.notificationToken,
                notification: {
                  title: title,
                  body: body,
                  icon: '/assets/icons/icon-192x192.png'
                },
                data: {
                  eventId: eventId,
                  type: 'event-reminder',
                  click_action: `/event-details/${eventId}`
                }
              };
              
              notificationPromises.push(
                admin.messaging().send(message).catch(error => {
                  console.error(`Error enviando notificación a ${userData.uid}:`, error);
                })
              );
              
              // Guardar en Firestore
              notificationPromises.push(
                admin.firestore().collection('notifications').add({
                  userId: userData.uid,
                  title: title,
                  body: body,
                  type: 'event-reminder',
                  eventId: eventId,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  read: false
                })
              );
            }
          });
          
          await Promise.all(notificationPromises);
          
          // Marcar recordatorio como enviado
          await admin.firestore().collection('reminder-log').doc(eventId).set({
            sent24h: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`Recordatorio 24h enviado para evento ${eventId}`);
        });
    });
    
    return null;
  });

// Función para recordatorio de 1 hora antes
export const sendEventRemindersOneHour = functions.pubsub
  .schedule('*/30 * * * *') // Cada 30 minutos
  .timeZone('America/Mexico_City')
  .onRun(async (context) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Obtener eventos de hoy que están abiertos
    const eventsSnapshot = await admin.firestore()
      .collection('events')
      .where('date', '==', todayStr)
      .where('status', '==', 'abierto')
      .get();

    if (eventsSnapshot.empty) {
      console.log('No hay eventos hoy');
      return null;
    }

    eventsSnapshot.forEach(async eventDoc => {
      const event = eventDoc.data();
      const eventId = eventDoc.id;
      
      // Si el evento no tiene hora de inicio, saltar
      if (!event.startTime) {
        return;
      }
      
      // Calcular si falta 1 hora
      const [hours, minutes] = event.startTime.split(':').map(Number);
      const eventTime = new Date(now);
      eventTime.setHours(hours, minutes, 0, 0);
      
      const timeDiff = eventTime.getTime() - now.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Si falta entre 0.5 y 1.5 horas
      if (hoursDiff >= 0.5 && hoursDiff <= 1.5) {
        // Revisar si ya se envió
        const logDoc = await admin.firestore().collection('reminder-log').doc(eventId).get();
        const logData = logDoc.data();
        
        if (logData && logData.sent1h) {
          console.log(`Recordatorio 1h ya enviado para evento ${eventId}`);
          return;
        }
        
        // Enviar notificaciones
        const usersSnapshot = await admin.firestore()
          .collection('users')
          .where('deleted', '==', false)
          .get();
        
        const notificationPromises: Promise<any>[] = [];
        
        usersSnapshot.forEach(userDoc => {
          const userData = userDoc.data();
          
          if (userData.notificationsEnabled && userData.notificationToken) {
            const title = `⏰ ¡Muy Pronto! ${getEventTypeText(event.type)}`;
            const body = `En 1 hora - ${event.title}\n⏰ ${event.startTime}\n📍 ${event.location || 'Lugar por confirmar'}`;
            
            const message = {
              token: userData.notificationToken,
              notification: {
                title: title,
                body: body,
                icon: '/assets/icons/icon-192x192.png'
              },
              data: {
                eventId: eventId,
                type: 'event-reminder-urgent',
                click_action: `/event-details/${eventId}`
              }
            };
            
            notificationPromises.push(
              admin.messaging().send(message).catch(error => {
                console.error(`Error enviando notificación a ${userData.uid}:`, error);
              })
            );
            
            notificationPromises.push(
              admin.firestore().collection('notifications').add({
                userId: userData.uid,
                title: title,
                body: body,
                type: 'event-reminder-urgent',
                eventId: eventId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
              })
            );
          }
        });
        
        await Promise.all(notificationPromises);
        
        // Marcar como enviado
        await admin.firestore().collection('reminder-log').doc(eventId).set({
          sent1h: true,
          sentAt1h: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log(`Recordatorio 1h enviado para evento ${eventId}`);
      }
    });
    
    return null;
  });

function getEventTypeText(type: string): string {
  switch (type) {
    case 'ensayo': return '🎵 Ensayo';
    case 'misa': return '⛪ Misa Dominical';
    case 'callejoneada': return '🎭 Callejoneada';
    case 'evento': return '🎉 Evento';
    case 'participacion': return '🎪 Participación';
    case 'contrato': return '📋 Contrato';
    default: return '📅 Evento';
  }
}
```

### Paso 5: Instalar Dependencias

En la carpeta `functions/`:

```bash
cd functions
npm install firebase-admin firebase-functions
```

### Paso 6: Desplegar Cloud Functions

```bash
firebase deploy --only functions
```

---

## 📅 Configuración de Horarios

### Recordatorios Configurados:

1. **24 horas antes** - Se ejecuta cada hora, revisa eventos del día siguiente
2. **1 hora antes** - Se ejecuta cada 30 minutos, revisa eventos del día actual

### Modificar Horarios:

Puedes cambiar la frecuencia editando el schedule:

```typescript
.schedule('0 * * * *')  // Cada hora
.schedule('*/30 * * * *')  // Cada 30 minutos
.schedule('0 8 * * *')  // Todos los días a las 8 AM
.schedule('0 12,18 * * *')  // Todos los días a las 12 PM y 6 PM
```

Formato: `minuto hora día mes día-semana`

---

## 🎨 Tipos de Notificaciones

### 📅 Recordatorio 24h
- **Título:** `🔔 Recordatorio: [Tipo de Evento]`
- **Mensaje:** `Mañana - [Título]\n⏰ [Hora]\n📍 [Ubicación]`

### ⏰ Recordatorio 1h
- **Título:** `⏰ ¡Muy Pronto! [Tipo de Evento]`
- **Mensaje:** `En 1 hora - [Título]\n⏰ [Hora]\n📍 [Ubicación]`

---

## 💰 Costos Estimados

### Plan Blaze - Firebase

**Cuota Gratuita Mensual:**
- 125,000 invocaciones de Cloud Functions
- 40,000 GB-segundos
- 40,000 GHz-segundos
- 5 GB de transferencia de salida

**Costos Adicionales (si excedes):**
- $0.40 por millón de invocaciones
- $0.0000025 por GB-segundo
- $0.0000100 por GHz-segundo

**Estimación para Estudiantina:**
- ~50 usuarios
- 10 eventos al mes
- 2 recordatorios por evento (24h y 1h)
- ~1,000 notificaciones al mes

**Costo estimado:** $0/mes (dentro de la cuota gratuita)

---

## 🔍 Monitoreo y Logs

### Ver Logs de Cloud Functions:

```bash
firebase functions:log
```

O en Firebase Console:
1. Ve a Functions
2. Click en la función
3. Ver "Logs"

### Colección de Logs:

Las funciones crean una colección `reminder-log` en Firestore:

```
reminder-log/
  {eventId}/
    - sent24h: true
    - sentAt: timestamp
    - sent1h: true
    - sentAt1h: timestamp
```

---

## 🐛 Solución de Problemas

### Error: "Permission denied"
- Verifica que el Service Account tenga permisos
- Revisa reglas de Firestore

### Notificaciones no llegan
- Verifica tokens FCM vigentes
- Revisa que notificationsEnabled esté en true
- Verifica en logs de Cloud Functions

### Función no se ejecuta
- Verifica el schedule
- Revisa zona horaria
- Verifica billing habilitado

---

## ✅ Verificación

### Probar Manualmente:

```bash
firebase functions:shell
```

Luego:
```javascript
sendEventReminders()
```

### Crear Evento de Prueba:

1. Crea un evento para mañana en la app
2. Espera 1 hora (o ejecuta manualmente)
3. Verifica que llegue la notificación

---

## 🔒 Seguridad

### Reglas de Firestore para reminder-log:

```javascript
match /reminder-log/{eventId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo Cloud Functions pueden escribir
}
```

---

## 📝 Notas Importantes

1. **Zona Horaria**: Configurada para America/Mexico_City
2. **Solo Eventos Abiertos**: No envía recordatorios para eventos cancelados
3. **Sin Duplicados**: Usa reminder-log para evitar enviar múltiples veces
4. **Escalable**: Funciona para 50 o 5,000 usuarios
5. **Histórico**: Guarda todas las notificaciones en Firestore

---

## 🚀 Alternativa Simple (Sin Cloud Functions)

Si no quieres usar Cloud Functions, puedes:

1. Crear un script en tu computadora que se ejecute periódicamente
2. Usar Windows Task Scheduler para ejecutarlo automáticamente
3. El script revisa Firestore y envía notificaciones

**Desventaja:** Solo funciona si tu computadora está encendida.

---

¿Necesitas ayuda con la implementación? ¡Estoy aquí para ayudarte! 🎉
