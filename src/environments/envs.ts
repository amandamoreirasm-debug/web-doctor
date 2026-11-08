export const envs = {
  firebase: {
    API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || "SUA_API_KEY",
    AUTH_DOMAIN:
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "SEU_AUTH_DOMAIN",
    PROJECT_ID:
      import.meta.env.VITE_FIREBASE_PROJECT_ID || "SEU_PROJECT_ID",
    STORAGE_BUCKET:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
      "SEU_PROJECT_ID.firebasestorage.app",
    MESSAGING_SENDER_ID:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "282554407746",
    APP_ID:
      import.meta.env.VITE_FIREBASE_APP_ID ||
      "1:282554407746:web:VITE_FIREBASE_APP_ID",
    MEASUREMENT_ID:
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MEASUREMENT_ID",
    VAPID_KEY: import.meta.env.VITE_FIREBASE_VAPID_KEY || "VAPID_KEY",
  },
};
