import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

/**
 * Enviar notificação para um médico específico usando Cloud Function
 */
export async function sendNotificationToDoctor(params: {
  doctorId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    const sendNotificationFunction = httpsCallable(
      functions,
      "sendNotification",
    );
    const result = await sendNotificationFunction(params);
    return result.data;
  } catch (error) {
    console.error("Erro ao chamar função de notificação:", error);
    throw error;
  }
}

/**
 * Enviar notificação em massa para múltiplos médicos
 */
export async function sendBulkNotifications(params: {
  doctorIds: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  try {
    const sendBulkFunction = httpsCallable(functions, "sendBulkNotifications");
    const result = await sendBulkFunction(params);
    return result.data;
  } catch (error) {
    console.error("Erro ao chamar função de notificação em massa:", error);
    throw error;
  }
}

/**
 * Criar documento de notificação para trigger automático
 * (Será processado pela Cloud Function sendNotificationToDoctor)
 */
export async function createNotificationDocument(params: {
  doctorId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const { db } = await import("../firebase/config");
  const { collection, addDoc, serverTimestamp } =
    await import("firebase/firestore");

  try {
    const notificationRef = await addDoc(collection(db, "notifications"), {
      ...params,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    console.log("Notificação criada:", notificationRef.id);
    return notificationRef.id;
  } catch (error) {
    console.error("Erro ao criar documento de notificação:", error);
    throw error;
  }
}
