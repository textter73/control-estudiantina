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
  private vapidKey = 'BCiToXwp2BrTlAC5wzM1mythL-iimdu4TpjLin9sdUdh6I5AIrrA6RaeNx5g6kd-bw3JR4QBPb93d9XPM639AdU'; // Clave VAPID de Firebase Console
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
      console.error('Error al inicializar Firebase Messaging:', error);
    }
  }

  /**
   * Escucha mensajes cuando la app está en primer plano
   */
  private listenToForegroundMessages(): void {
    if (this.messaging) {
      onMessage(this.messaging, (payload) => {
        console.log('Mensaje recibido en primer plano:', payload);
        
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
          console.log('Token FCM obtenido:', token);
          
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

          console.log('Token de notificación guardado en Firestore');
        } else {
          console.warn('No se pudo obtener el token de FCM');
        }
      }
    } catch (error) {
      console.error('Error al guardar token:', error);
      
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
      console.error('Error al desactivar notificaciones:', error);
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
      console.log('Notificaciones no habilitadas');
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
      console.error('Error al obtener eventos:', error);
    }
  }
}
