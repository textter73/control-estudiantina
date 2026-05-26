import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { initializeApp } from 'firebase/app';
import Swal from 'sweetalert2';
import { firebaseConfig } from '../../environments/firebase.config';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private vapidKey = 'BDHeUimW99l9rzmvxlHeJizL8JsOkDiBbJ29GOuRsRtHysEKT1h16OFJ_aIKWG7drFXp56ouL-FL4UOmdyVqSc0'; // Clave VAPID de Firebase Console
  private messaging: any;

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth
  ) {
    this.initMessaging();
  }

  /**
   * Inicializa Firebase Messaging
   */
  private initMessaging(): void {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const app = initializeApp(firebaseConfig);
        this.messaging = getMessaging(app);
        this.listenToForegroundMessages();
      }
    } catch (error) {
      // Error al inicializar Firebase Messaging
    }
  }

  /**
   * Escucha mensajes cuando la app está en primer plano
   */
  private listenToForegroundMessages(): void {
    if (this.messaging) {
      onMessage(this.messaging, (payload) => {
        // Mostrar notificación personalizada
        if (payload.notification) {
          this.showLocalNotification(
            payload.notification.title || 'Nueva notificación',
            payload.notification.body || '',
            (payload.notification as any).icon || '/assets/icons/icon-192x192.png'
          );
        }
      });
    }
  }

  /**
   * Solicita permiso para enviar notificaciones
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      await Swal.fire({
        icon: 'error',
        title: 'No soportado',
        text: 'Tu navegador no soporta notificaciones push',
        confirmButtonColor: '#189d98'
      });
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      await Swal.fire({
        icon: 'warning',
        title: 'Permisos denegados',
        text: 'Has bloqueado las notificaciones. Actívalas en la configuración de tu navegador.',
        confirmButtonColor: '#189d98'
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      await this.saveNotificationToken();
      await Swal.fire({
        icon: 'success',
        title: '¡Listo!',
        text: 'Ahora recibirás notificaciones en este dispositivo',
        confirmButtonColor: '#189d98',
        timer: 3000
      });
      return true;
    }

    return false;
  }

  /**
   * Guarda el token de notificaciones en Firestore
   */
  private async saveNotificationToken(): Promise<void> {
    try {
      const user = await this.auth.currentUser;
      if (!user) return;

      // Registrar el Service Worker
      if ('serviceWorker' in navigator && this.messaging) {
        const registration = await navigator.serviceWorker.ready;
        
        // Obtener el token de FCM usando la clave VAPID
        const token = await getToken(this.messaging, {
          vapidKey: this.vapidKey,
          serviceWorkerRegistration: registration
        });

        if (token) {
          // Guardar el token en Firestore
          await this.firestore.collection('users').doc(user.uid).update({
            notificationsEnabled: true,
            notificationToken: token,
            notificationPreferences: {
              dailyEvents: true,
              eventReminders: true,
              paymentAlerts: true
            },
            lastTokenUpdate: new Date()
          });
        }
      }
    } catch (error) {
      // Si hay error de permisos, intentar con notificaciones locales
      if (error && typeof error === 'object' && 'code' in error && error.code === 'messaging/permission-blocked') {
        await Swal.fire({
          icon: 'error',
          title: 'Permisos bloqueados',
          text: 'Debes permitir las notificaciones en tu navegador',
          confirmButtonColor: '#189d98'
        });
      }
    }
  }

  /**
   * Desactiva las notificaciones para el usuario actual
   */
  async disableNotifications(): Promise<void> {
    try {
      const user = await this.auth.currentUser;
      if (!user) return;

      await this.firestore.collection('users').doc(user.uid).update({
        notificationsEnabled: false,
        notificationToken: null
      });

      await Swal.fire({
        icon: 'info',
        title: 'Notificaciones desactivadas',
        text: 'Ya no recibirás notificaciones push',
        confirmButtonColor: '#189d98',
        timer: 2000
      });
    } catch (error) {
      // Error al desactivar notificaciones
    }
  }

  /**
   * Verifica si las notificaciones están habilitadas
   */
  isNotificationEnabled(): boolean {
    return Notification.permission === 'granted';
  }

  /**
   * Muestra una notificación local (para pruebas)
   */
  async showLocalNotification(title: string, body: string, icon?: string): Promise<void> {
    if (!this.isNotificationEnabled()) {
      return;
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification(title, {
        body: body,
        icon: icon || '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1
        },
        actions: [
          {
            action: 'explore',
            title: 'Ver eventos'
          },
          {
            action: 'close',
            title: 'Cerrar'
          }
        ]
      } as any);
    }
  }

  /**
   * Obtiene los eventos del mes para las notificaciones diarias
   */
  async getDailyEventsNotification(): Promise<void> {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const eventsSnapshot = await this.firestore.collection('events', ref =>
        ref.where('date', '>=', startOfMonth)
           .where('date', '<=', endOfMonth)
           .orderBy('date', 'asc')
      ).get().toPromise();

      const events = eventsSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as any
      })) || [];

      if (events.length > 0) {
        const eventsList = events.slice(0, 5).map((e: any) => {
          const eventDate = e.date?.toDate();
          return `• ${eventDate?.toLocaleDateString('es-MX')} - ${e.name}`;
        }).join('\n');

        await this.showLocalNotification(
          `📅 Eventos de ${today.toLocaleDateString('es-MX', { month: 'long' })}`,
          `Tienes ${events.length} evento(s) este mes:\n\n${eventsList}`,
          '/assets/icons/icon-192x192.png'
        );
      } else {
        await this.showLocalNotification(
          '📅 Sin eventos programados',
          'No hay eventos programados para este mes',
          '/assets/icons/icon-192x192.png'
        );
      }
    } catch (error) {
      // Error al obtener eventos
    }
  }

  /**
   * Envía notificaciones de depósito al usuario, administradores y usuarios de finanzas
   * @param userId ID del usuario que recibe el depósito
   * @param amount Monto del depósito
   * @param concept Concepto del depósito
   * @param userName Nombre del usuario (opcional, se obtiene de Firestore si no se proporciona)
   */
  async sendDepositNotifications(
    userId: string,
    amount: number,
    concept: string,
    userName?: string
  ): Promise<void> {
    try {
      // Obtener datos del usuario si no se proporcionó el nombre
      let recipientName = userName;
      if (!recipientName) {
        const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
        const userData = userDoc?.data() as any;
        recipientName = userData?.name || 'Usuario';
      }

      // 1. Enviar notificación al usuario que recibe el depósito
      await this.sendNotificationToUser(
        userId,
        `💰 Depósito Recibido`,
        `Se depositó $${amount.toFixed(2)} a tu cuenta. Concepto: ${concept}`
      );

      // 2. Enviar notificación a todos los administradores y usuarios de finanzas
      const adminUsers = await this.firestore.collection('users', ref =>
        ref.where('profiles', 'array-contains', 'administrador')
      ).get().toPromise();

      const financeUsers = await this.firestore.collection('users', ref =>
        ref.where('profiles', 'array-contains', 'finanzas')
      ).get().toPromise();

      // Combinar resultados y eliminar duplicados
      const notifiedUserIds = new Set<string>();

      // Enviar a administradores
      if (adminUsers && !adminUsers.empty) {
        for (const adminDoc of adminUsers.docs) {
          const adminId = adminDoc.id;
          
          // No enviar notificación si es el mismo usuario que recibe el depósito
          if (adminId !== userId && !notifiedUserIds.has(adminId)) {
            await this.sendNotificationToUser(
              adminId,
              `💵 Depósito Realizado`,
              `Depósito de $${amount.toFixed(2)} a ${recipientName}. Concepto: ${concept}`
            );
            notifiedUserIds.add(adminId);
          }
        }
      }

      // Enviar a usuarios de finanzas
      if (financeUsers && !financeUsers.empty) {
        for (const financeDoc of financeUsers.docs) {
          const financeId = financeDoc.id;
          
          // No enviar notificación si es el mismo usuario que recibe el depósito o ya fue notificado
          if (financeId !== userId && !notifiedUserIds.has(financeId)) {
            await this.sendNotificationToUser(
              financeId,
              `💵 Depósito Realizado`,
              `Depósito de $${amount.toFixed(2)} a ${recipientName}. Concepto: ${concept}`
            );
            notifiedUserIds.add(financeId);
          }
        }
      }
    } catch (error) {
      // Error al enviar notificaciones de depósito
    }
  }

  /**
   * Envía notificaciones de retiro al usuario, administradores y usuarios de finanzas
   * @param userId ID del usuario del cual se retira
   * @param amount Monto del retiro
   * @param concept Concepto del retiro
   * @param userName Nombre del usuario (opcional, se obtiene de Firestore si no se proporciona)
   */
  async sendWithdrawalNotifications(
    userId: string,
    amount: number,
    concept: string,
    userName?: string
  ): Promise<void> {
    try {
      // Obtener datos del usuario si no se proporcionó el nombre
      let recipientName = userName;
      if (!recipientName) {
        const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
        const userData = userDoc?.data() as any;
        recipientName = userData?.name || 'Usuario';
      }

      // 1. Enviar notificación al usuario del cual se retiró
      await this.sendNotificationToUser(
        userId,
        `💸 Retiro Realizado`,
        `Se retiró $${amount.toFixed(2)} de tu cuenta. Concepto: ${concept}`
      );

      // 2. Enviar notificación a todos los administradores y usuarios de finanzas
      const adminUsers = await this.firestore.collection('users', ref =>
        ref.where('profiles', 'array-contains', 'administrador')
      ).get().toPromise();

      const financeUsers = await this.firestore.collection('users', ref =>
        ref.where('profiles', 'array-contains', 'finanzas')
      ).get().toPromise();

      // Combinar resultados y eliminar duplicados
      const notifiedUserIds = new Set<string>();

      // Enviar a administradores
      if (adminUsers && !adminUsers.empty) {
        for (const adminDoc of adminUsers.docs) {
          const adminId = adminDoc.id;
          
          // No enviar notificación si es el mismo usuario del retiro
          if (adminId !== userId && !notifiedUserIds.has(adminId)) {
            await this.sendNotificationToUser(
              adminId,
              `💸 Retiro Procesado`,
              `Retiro de $${amount.toFixed(2)} de la cuenta de ${recipientName}. Concepto: ${concept}`
            );
            notifiedUserIds.add(adminId);
          }
        }
      }

      // Enviar a usuarios de finanzas
      if (financeUsers && !financeUsers.empty) {
        for (const financeDoc of financeUsers.docs) {
          const financeId = financeDoc.id;
          
          // No enviar notificación si es el mismo usuario del retiro o ya fue notificado
          if (financeId !== userId && !notifiedUserIds.has(financeId)) {
            await this.sendNotificationToUser(
              financeId,
              `💸 Retiro Procesado`,
              `Retiro de $${amount.toFixed(2)} de la cuenta de ${recipientName}. Concepto: ${concept}`
            );
            notifiedUserIds.add(financeId);
          }
        }
      }
    } catch (error) {
      // Error al enviar notificaciones de retiro
    }
  }

  /**
   * Envía una notificación a un usuario específico
   * @param userId ID del usuario
   * @param title Título de la notificación
   * @param body Cuerpo de la notificación
   */
  private async sendNotificationToUser(
    userId: string,
    title: string,
    body: string
  ): Promise<void> {
    try {
      // Obtener el usuario y verificar si tiene notificaciones habilitadas
      const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userData = userDoc?.data() as any;

      if (!userData) {
        return;
      }

      // Mostrar notificación aunque no tenga habilitadas las notificaciones
      // (se guardará en Firestore para verlas más tarde)
      
      // Guardar la notificación individual para este usuario en Firestore
      await this.firestore.collection('notifications').add({
        userId: userId,
        title: title,
        body: body,
        type: 'deposit',
        createdAt: new Date(),
        read: false
      });

      // Si el usuario tiene notificaciones habilitadas, intentar mostrar notificación push
      if (userData.notificationsEnabled && userData.notificationToken) {
        // Verificar si el usuario actual es el destinatario para mostrar notificación local
        const currentUser = await this.auth.currentUser;
        
        if (currentUser && currentUser.uid === userId) {
          // Usuario activo - mostrar notificación inmediatamente
          await this.showLocalNotification(title, body, '/assets/icons/icon-192x192.png');
        } else {
          // Usuario no activo - intentar enviar a través del service worker
          await this.sendPushNotification(userId, title, body, userData.notificationToken);
        }
      }

    } catch (error) {
      // Error al enviar notificación al usuario
    }
  }

  /**
   * Envía una notificación push real a través del Service Worker
   * @param userId ID del usuario
   * @param title Título de la notificación
   * @param body Cuerpo de la notificación
   * @param token Token FCM del usuario
   */
  private async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    token: string
  ): Promise<void> {
    try {
      // En una aplicación real, aquí enviarías una solicitud a tu backend
      // que usaría la Admin SDK de Firebase para enviar el mensaje FCM
      
      // Por ahora, guardamos en Firestore y el usuario la verá cuando abra la app
      // NOTA: Para implementar esto completamente, necesitas:
      // 1. Firebase Cloud Functions
      // 2. Llamar a una función que use firebase-admin para enviar el mensaje
      // 3. Ejemplo: await this.firestore.collection('fcm-queue').add({ userId, title, body, token });
      
    } catch (error) {
      // Error al enviar push notification
    }
  }

  /**
   * Envía una notificación de prueba a todos los usuarios con notificaciones activas
   * Solo para administradores
   */
  async sendTestNotificationToAll(): Promise<void> {
    try {
      // Obtener todos los usuarios con notificaciones habilitadas
      const usersWithNotifications = await this.firestore.collection('users', ref =>
        ref.where('notificationsEnabled', '==', true)
      ).get().toPromise();

      if (!usersWithNotifications || usersWithNotifications.empty) {
        await Swal.fire({
          icon: 'info',
          title: 'Sin destinatarios',
          text: 'No hay usuarios con notificaciones habilitadas en este momento',
          confirmButtonColor: '#189d98'
        });
        return;
      }

      const usersCount = usersWithNotifications.docs.length;

      // Confirmar envío
      const result = await Swal.fire({
        icon: 'question',
        title: '¿Enviar notificación de prueba?',
        html: `
          <p>Se enviará una notificación de prueba a <strong>${usersCount} usuario${usersCount > 1 ? 's' : ''}</strong></p>
          <p>¿Deseas continuar?</p>
        `,
        showCancelButton: true,
        confirmButtonColor: '#189d98',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, enviar',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) {
        return;
      }

      // Mostrar loading mientras se envían las notificaciones
      Swal.fire({
        title: 'Enviando notificaciones...',
        html: `
          <div style="margin: 20px 0;">
            <p style="font-size: 1.1rem; margin-bottom: 10px;">Enviando a <strong>${usersCount}</strong> usuario${usersCount > 1 ? 's' : ''}</p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin-top: 15px;">
              <p style="font-size: 1.5rem; font-weight: bold; color: #189d98; margin: 0;" id="progress-text">0 / ${usersCount}</p>
            </div>
          </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      // Enviar notificación a cada usuario
      let successCount = 0;
      for (const userDoc of usersWithNotifications.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data() as any;
        
        try {
          await this.sendNotificationToUser(
            userId,
            '🔔 Notificación de Prueba',
            `Hola ${userData.name || 'Usuario'}, esta es una notificación de prueba del sistema de la Estudiantina Tonantzin Guadalupe 🎵`
          );
          successCount++;
          
          // Actualizar el progreso en el loading
          const progressElement = document.getElementById('progress-text');
          if (progressElement) {
            progressElement.textContent = `${successCount} / ${usersCount}`;
          }
        } catch (error) {
          // Error al enviar notificación
        }
      }

      // Cerrar el loading y mostrar resultado
      Swal.close();

      await Swal.fire({
        icon: 'success',
        title: '¡Notificaciones enviadas!',
        html: `
          <p>Se enviaron <strong>${successCount}</strong> notificaciones de prueba exitosamente</p>
          <p>Los usuarios las recibirán según su estado de conexión</p>
        `,
        confirmButtonColor: '#189d98',
        timer: 4000
      });

    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al enviar las notificaciones de prueba',
        confirmButtonColor: '#189d98'
      });
    }
  }
}
