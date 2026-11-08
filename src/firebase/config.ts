import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";
import { envs } from "../environments/envs";

const firebaseConfig = {
  apiKey: envs.firebase.API_KEY,
  authDomain: envs.firebase.AUTH_DOMAIN,
  projectId: envs.firebase.PROJECT_ID,
  storageBucket: envs.firebase.STORAGE_BUCKET,
  messagingSenderId: envs.firebase.MESSAGING_SENDER_ID,
  appId: envs.firebase.APP_ID,
  measurementId: envs.firebase.MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export let messaging: Messaging | null = null;
export const functions = getFunctions(app);

isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
  }
});
