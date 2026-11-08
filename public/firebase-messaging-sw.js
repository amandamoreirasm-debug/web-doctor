/* Service worker for Firebase Messaging - built by Vite so env vars are injected */
const localenvs = {
  firebase: {
    API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    VAPID_KEY: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  },
};

importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js",
);

firebase.initializeApp({
  apiKey: localenvs.firebase.API_KEY,
  authDomain: localenvs.firebase.AUTH_DOMAIN,
  projectId: localenvs.firebase.PROJECT_ID,
  storageBucket: localenvs.firebase.STORAGE_BUCKET,
  messagingSenderId: localenvs.firebase.MESSAGING_SENDER_ID,
  appId: localenvs.firebase.APP_ID,
  measurementId: localenvs.firebase.MEASUREMENT_ID,
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Mensagem recebida:", payload);

  const notificationTitle = payload.notification?.title || "Nova notificação";
  const notificationOptions = {
    body: payload.notification?.body || "",
    data: payload.data || {},
    icon: '/stethoscope.svg',
    badge: '/stethoscope.svg',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Evento de clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificação clicada:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.click_action || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
