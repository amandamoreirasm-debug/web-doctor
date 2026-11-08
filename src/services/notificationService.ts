import { getDoc } from "firebase/firestore";
import { messaging, functions } from "../firebase/config";
import { getToken, onMessage } from "firebase/messaging";
import { httpsCallable } from "firebase/functions";

// Função para registrar e salvar token do médico
export async function registerAndSaveDoctorToken(
  doctorId: string,
): Promise<string | null> {
  try {
    // 1. Solicitar permissão
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("⚠️ Permissão de notificação negada");
      return null;
    }

    // 2. Obter token FCM
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging!, { vapidKey });

    if (!token) {
      console.log("❌ Não foi possível obter o token");
      return null;
    }

    console.log("✅ Token FCM obtido:", token.slice(0, 20) + "...");

    // 3. Salvar token usando Cloud Function para garantir consistência
    const deviceInfo = getDeviceInfo();
    const registerToken = httpsCallable(functions, "registerDoctorToken");
    const result = await registerToken({ doctorId, token, device: deviceInfo });

    console.log(
      `✅ Token registrado via Cloud Function para ${deviceInfo} (doctorId: ${doctorId})`,
      result.data,
    );

    return token;
  } catch (error) {
    console.error("❌ Erro ao registrar token:", error);
    return null;
  }
}

// Detectar dispositivo/navegador
export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return "Mobile";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/edge/i.test(ua)) return "Edge";
  return "Web";
}

// Solicitar permissão e obter token FCM para web
// export async function requestNotificationPermission(): Promise<string | null> {
//   try {
//     // Solicitar permissão
//     const permission = await Notification.requestPermission();
//     if (permission !== "granted") {
//       console.log("Permissão de notificação negada");
//       return null;
//     }

//     // Obter token VAPID (configure no Firebase Console)
//     const vapidKey = envs.firebase.VAPID_KEY;

//     const token = await getToken(messaging, { vapidKey });

//     if (token) {
//       console.log("Token FCM:", token);
//       return token;
//     } else {
//       console.log("Não foi possível obter o token");
//       return null;
//     }
//   } catch (error) {
//     console.error("Erro ao obter token de notificação:", error);
//     return null;
//   }
// }

// Escutar mensagens recebidas enquanto o app está em primeiro plano
export function onMessageListener(callback: (payload: any) => void) {
  if (!messaging) {
    console.error("Messaging não está disponível");
    return () => {};
  }
  return onMessage(messaging, (payload) => {
    console.log("Mensagem recebida em primeiro plano:", payload);
    callback(payload);
  });
}

// Salvar token do médico no Firestore (legado - não mais usado)
export async function saveDoctorFCMToken(doctorId: string, token: string) {
  const { db } = await import("../firebase/config");
  const { doc, updateDoc } = await import("firebase/firestore");

  const doctorRef = doc(db, "doctors", doctorId);
  const doctorSnap = await getDoc(doctorRef);

  const currentToken = doctorSnap.data()?.fcmToken;

  console.log("currentToken", currentToken);

  if (currentToken !== token) {
    await updateDoc(doctorRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString(),
    });
  }
}

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Registrar o service worker
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Permissão negada");
      return null;
    }

    if (!messaging) {
      console.error("Messaging não está disponível");
      return null;
    }

    // Aguardar o service worker estar ativo
    await registration.active;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    console.log("Token FCM obtido com sucesso:", token);
    return token;
  } catch (error) {
    console.error("Erro ao obter token de notificação:", error);
    return null;
  }
}
