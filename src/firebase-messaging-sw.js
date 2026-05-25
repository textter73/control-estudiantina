// Service Worker personalizado para manejar notificaciones push con Firebase Cloud Messaging
// Este código se ejecutará junto con ngsw-worker.js

// Importar Firebase Messaging SDK
importScripts('https://www.gstatic.com/firebasejs/9.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.9.0/firebase-messaging-compat.js');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBS-FihwcorFtupxy5rvm0EJNCxiu_Eod0",
  authDomain: "control-estonantzin.firebaseapp.com",
  projectId: "control-estonantzin",
  storageBucket: "control-estonantzin.firebasestorage.app",
  messagingSenderId: "197145425496",
  appId: "1:197145425496:web:9db4803a731399de1b3c2d",
  measurementId: "G-EGLGWSHBTN"
};

// Inicializar Firebase en el Service Worker
firebase.initializeApp(firebaseConfig);

// Obtener instancia de Firebase Messaging
const messaging = firebase.messaging();

// Manejar mensajes en segundo plano (cuando la app está cerrada o en background)
messaging.onBackgroundMessage((payload) => {
  console.log('Mensaje recibido en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || 'Estudiantina Tonantzin';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una nueva notificación',
    icon: payload.notification?.icon || '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    actions: [
      {
        action: 'explore',
        title: 'Ver eventos',
        icon: '/assets/icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/assets/icons/icon-72x72.png'
      }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clicks en las notificaciones
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);

  event.notification.close();

  if (event.action === 'explore') {
    // Abrir la app en la sección de eventos
    event.waitUntil(
      clients.openWindow('/event-management')
    );
  } else if (event.action === 'close') {
    // Solo cerrar la notificación
    return;
  } else {
    // Click en el cuerpo de la notificación - abrir la app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(function(clientList) {
          // Si ya hay una ventana abierta, enfocarla
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // Si no hay ventana abierta, abrir una nueva
          if (clients.openWindow) {
            return clients.openWindow('/dashboard');
          }
        })
    );
  }
});

// Manejar el cierre de notificaciones
self.addEventListener('notificationclose', function(event) {
  console.log('Notification closed:', event);
});
