import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

// ============================================
// FUNÇÃO AUXILIAR: Extrair tokens ativos
// ============================================
function getActiveTokens(fcmTokens: any): string[] {
  if (!fcmTokens || typeof fcmTokens !== "object") return [];

  const tokens: string[] = [];
  const now = new Date();
  const maxAgeDays = 30;

  for (const [token, info] of Object.entries(fcmTokens)) {
    if (!token || typeof token !== "string" || token.length < 10) continue;

    const tokenData = info as { lastUsed?: string };
    const lastUsed = tokenData.lastUsed ? new Date(tokenData.lastUsed) : null;

    if (lastUsed) {
      const daysSinceLastUse =
        (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastUse > maxAgeDays) continue;
    }

    tokens.push(token);
  }

  return tokens;
}

// ============================================
// FUNÇÃO 0: Notificar médico quando paciente cancelar (onUpdate)
// ============================================
export const notifyDoctorOnPatientCancellation = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const { data } = event;
    if (!data) return;

    const before = data.before.data();
    const after = data.after.data();

    // Verificar se o status mudou para patient_cancelled
    const statusChangedToPatientCancelled =
      before.status !== "patient_cancelled" &&
      after.status === "patient_cancelled";

    if (!statusChangedToPatientCancelled) {
      return;
    }

    const { doctorId, patientName, date, time } = after;

    if (!doctorId) {
      console.log("❌ No doctorId");
      return;
    }

    try {
      // Query by doctorId field instead of document ID
      const doctorQuery = await admin
        .firestore()
        .collection("doctors")
        .where("doctorId", "==", doctorId)
        .limit(1)
        .get();

      if (doctorQuery.empty) {
        console.log("❌ Doctor not found with doctorId:", doctorId);
        return;
      }

      const doctorDoc = doctorQuery.docs[0];
      const tokens = getActiveTokens(doctorDoc.data()?.fcmTokens);

      if (tokens.length === 0) {
        console.log("⚠️ No active tokens for doctor:", doctorId);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const title = "❌ Paciente Cancelou Consulta";
      const body =
        date === today
          ? `Hoje às ${time} - Paciente: ${patientName}`
          : `${new Date(date).toLocaleDateString("pt-BR")} às ${time} - Paciente: ${patientName}`;

      const message = {
        notification: { title, body },
        data: {
          type: "patient_cancellation",
          appointmentId: event.params.appointmentId,
          doctorId: doctorId,
          patientName: patientName,
          date: date,
          time: time,
        },
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log(
        `✅ Notificação enviada para médico ${doctorId} sobre cancelamento do paciente`,
      );
    } catch (error) {
      console.error(
        "❌ Error sending notification to doctor about patient cancellation:",
        error,
      );
    }
  },
);

// ============================================
// FUNÇÃO 1: Registrar token FCM do médico
// ============================================
export const registerDoctorToken = onCall(async (request) => {
  const { doctorId, token, device } = request.data;

  if (!doctorId || !token) {
    throw new Error("doctorId and token are required");
  }

  try {
    // Query by doctorId field instead of document ID
    const doctorQuery = await admin
      .firestore()
      .collection("doctors")
      .where("doctorId", "==", doctorId)
      .limit(1)
      .get();

    if (doctorQuery.empty) {
      throw new Error("Doctor not found");
    }

    const doctorDoc = doctorQuery.docs[0];
    const doctorRef = doctorDoc.ref;

    const tokenData = {
      device: device || "Web",
      lastUsed: new Date().toISOString(),
    };

    // Update fcmTokens field with the new token
    await doctorRef.update({
      [`fcmTokens.${token}`]: tokenData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Token registrado para médico ${doctorId} (${device})`);

    return {
      success: true,
      message: "Token registrado com sucesso",
    };
  } catch (error) {
    console.error("❌ Erro ao registrar token:", error);
    throw new Error((error as Error).message);
  }
});

// ============================================
// FUNÇÃO 2: Notificação via trigger (document created)
// ============================================
export const sendNotificationToDoctor = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const notification = snapshot.data();
    const { doctorId, title, body, data } = notification;

    if (!doctorId) {
      console.log("❌ No doctorId");
      return;
    }

    try {
      // Query by doctorId field instead of document ID
      const doctorQuery = await admin
        .firestore()
        .collection("doctors")
        .where("doctorId", "==", doctorId)
        .limit(1)
        .get();

      if (doctorQuery.empty) {
        console.log("❌ Doctor not found with doctorId:", doctorId);
        return;
      }

      const doctorDoc = doctorQuery.docs[0];
      const tokens = getActiveTokens(doctorDoc.data()?.fcmTokens);

      if (tokens.length === 0) {
        console.log("⚠️ No active tokens for doctor:", doctorId);
        return;
      }

      // Enviar para todos os tokens
      const message = {
        notification: {
          title: title || "Nova notificação",
          body: body || "Você tem uma nova mensagem",
        },
        data: data || {},
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `✅ Enviado: ${response.successCount} sucessos, ${response.failureCount} falhas`,
      );

      await snapshot.ref.update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        recipientCount: tokens.length,
        successCount: response.successCount,
        failureCount: response.failureCount,
      });
    } catch (error) {
      console.error("❌ Error:", error);
      await snapshot.ref.update({
        status: "failed",
        error: (error as Error).message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);

// ============================================
// FUNÇÃO 3: Notificação via HTTP Callable (single)
// ============================================
export const sendNotification = onCall(async (request) => {
  const { doctorId, title, body, data } = request.data;

  if (!doctorId) throw new Error("doctorId is required");
  if (!title || !body) throw new Error("title and body are required");

  // Query by doctorId field instead of document ID
  const doctorQuery = await admin
    .firestore()
    .collection("doctors")
    .where("doctorId", "==", doctorId)
    .limit(1)
    .get();

  if (doctorQuery.empty) throw new Error("Doctor not found");

  const doctorDoc = doctorQuery.docs[0];
  const tokens = getActiveTokens(doctorDoc.data()?.fcmTokens);

  if (tokens.length === 0) throw new Error("No active FCM tokens");

  const message = {
    notification: { title, body },
    data: data || {},
    tokens: tokens,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  return {
    success: true,
    recipientCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
  };
});

// ============================================
// FUNÇÃO 4: Notificação em lote (HTTP Callable)
// ============================================
export const sendBulkNotifications = onCall(async (request) => {
  const { doctorIds, title, body, data } = request.data;

  if (!doctorIds || !Array.isArray(doctorIds) || doctorIds.length === 0) {
    throw new Error("doctorIds must be a non-empty array");
  }
  if (!title || !body) throw new Error("title and body are required");

  const results: { success: number; failed: number; errors: string[] } = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const doctorId of doctorIds) {
    try {
      // Query by doctorId field instead of document ID
      const doctorQuery = await admin
        .firestore()
        .collection("doctors")
        .where("doctorId", "==", doctorId)
        .limit(1)
        .get();

      if (doctorQuery.empty) {
        results.failed++;
        results.errors.push(`Doctor not found: ${doctorId}`);
        continue;
      }

      const doctorDoc = doctorQuery.docs[0];
      const tokens = getActiveTokens(doctorDoc.data()?.fcmTokens);

      if (tokens.length === 0) {
        results.failed++;
        results.errors.push(`No active tokens: ${doctorId}`);
        continue;
      }

      const message = {
        notification: { title, body },
        data: data || {},
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error for ${doctorId}: ${(error as Error).message}`);
    }
  }

  return results;
});

// ============================================
// FUNÇÃO 5: Notificar paciente (onUpdate)
// ============================================
export const notifyPatientOnAppointmentUpdate = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const { data } = event;
    if (!data) return;

    const before = data.before.data();
    const after = data.after.data();

    const statusChanged = before.status !== after.status;
    const dateChanged = before.date !== after.date;
    const timeChanged = before.time !== after.time;

    if (!statusChanged && !dateChanged && !timeChanged) {
      console.log("📋 Sem mudanças relevantes");
      return;
    }

    const { patientId, status, date, time } = after;

    if (!patientId) {
      console.log("❌ No patientId");
      return;
    }

    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(patientId)
        .get();

      if (!userDoc.exists) {
        console.log("❌ User not found:", patientId);
        return;
      }

      const tokens = getActiveTokens(userDoc.data()?.fcmTokens);

      if (tokens.length === 0) {
        console.log("⚠️ No active tokens for patient:", patientId);
        return;
      }

      let title = "Atualização no Agendamento";
      let body = "";

      if (statusChanged) {
        const statusMessages: Record<string, string> = {
          confirmed: `✅ Consulta confirmada para ${date} às ${time}`,
          cancelled: `❌ Consulta cancelada para ${date} às ${time}`,
          patient_cancelled: `❌ Consulta cancelada pelo paciente para ${date} às ${time}`,
          completed: `🏁 Consulta realizada em ${date}`,
          scheduled: `📋 Consulta agendada para ${date} às ${time}`,
        };
        body = statusMessages[status] || `Status alterado para: ${status}`;
        title =
          status === "confirmed"
            ? "✅ Consulta confirmada!"
            : status === "cancelled"
              ? "❌ Consulta cancelada"
              : status === "patient_cancelled"
                ? "❌ Paciente cancelou a consulta"
                : status === "completed"
                  ? "🏁 Consulta realizada"
                  : "📋 Atualização no agendamento";
      } else if (dateChanged || timeChanged) {
        title = "🔄 Horário alterado";
        body = `Seu agendamento foi alterado para ${date} às ${time}`;
      }

      if (!title || !body) return;

      const message = {
        notification: { title, body },
        data: {
          type: "appointment_update",
          appointmentId: event.params.appointmentId,
          patientId: patientId,
          doctorId: before.doctorId,
          status: status,
          date: date,
          time: time,
        },
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Notificação enviada para paciente ${patientId}`);
    } catch (error) {
      console.error("❌ Error sending notification to patient:", error);
    }
  },
);
