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
// Utilitários de validação de horário (mantidos)
// ============================================
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function hasTimeConflict(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return !(end1 <= start2 || end2 <= start1);
}

function calculateAppointmentInterval(time: string, duration: number) {
  const start = timeToMinutes(time);
  return { start, end: start + duration };
}

async function validateAppointmentConflict(
  db: admin.firestore.Firestore,
  doctorId: string,
  date: string,
  time: string,
  duration: number,
  excludeAppointmentId?: string,
): Promise<{ valid: boolean; error?: string }> {
  const snapshot = await db
    .collection("appointments")
    .where("doctorId", "==", doctorId)
    .where("date", "==", date)
    .get();

  if (snapshot.empty) return { valid: true };

  const newInterval = calculateAppointmentInterval(time, duration);

  for (const doc of snapshot.docs) {
    if (excludeAppointmentId && doc.id === excludeAppointmentId) continue;

    const existing = doc.data();
    const existingInterval = calculateAppointmentInterval(
      existing.time,
      existing.duration,
    );

    if (
      hasTimeConflict(
        newInterval.start,
        newInterval.end,
        existingInterval.start,
        existingInterval.end,
      )
    ) {
      return {
        valid: false,
        error: `Conflito de horário: Já existe agendamento das ${existing.time} às ${minutesToTime(existingInterval.end)}`,
      };
    }
  }

  return { valid: true };
}

// ============================================
// FUNÇÃO 0: Registrar token FCM do médico
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
// FUNÇÃO 1: Notificação para médico (trigger)
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
// FUNÇÃO 2: Notificação para médico (callable)
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
// FUNÇÃO 3: Notificação em lote (callable)
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

      await admin.messaging().sendEachForMulticast({
        notification: { title, body },
        data: data || {},
        tokens: tokens,
      });

      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Error for ${doctorId}: ${(error as Error).message}`);
    }
  }

  return results;
});

// ============================================
// FUNÇÃO 4: Notificar médico quando paciente cancelar (onUpdate)
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
// FUNÇÃO AUXILIAR: Formatar data para exibição
// ============================================
function formatDateBR(date: string): string {
  if (!date) return "";
  try {
    // "2026-06-15" → "15/06/2026"
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return date;
  }
}

export const notifyPatientOnAppointmentUpdate = onDocumentUpdated(
  "appointments/{appointmentId}",
  async (event) => {
    const { data } = event;
    if (!data) return;

    const before = data.before.data();
    const after = data.after.data();

    // Detectar mudanças relevantes
    const statusChanged = before.status !== after.status;
    const dateChanged = before.date !== after.date;
    const timeChanged = before.time !== after.time;
    const locationChanged = before.location !== after.location;

    if (!statusChanged && !dateChanged && !timeChanged && !locationChanged) {
      console.log("📋 Sem mudanças relevantes — ignorando");
      return;
    }

    // Ignorar cancelamento feito pelo próprio paciente
    // (ele já sabe, não precisa ser notificado de novo)
    if (statusChanged && after.status === "patient_cancelled") {
      console.log("📋 Cancelamento feito pelo paciente — sem notificação");
      return;
    }

    const { patientId, status, date, time, location, doctorName } = after;

    if (!patientId) {
      console.log("❌ No patientId in appointment");
      return;
    }

    try {
      // ==========================================
      // 🔑 BUSCA PELO CAMPO patientId (não pelo doc ID)
      // ==========================================
      const userQuery = await admin
        .firestore()
        .collection("users")
        .where("patientId", "==", patientId)
        .limit(1)
        .get();

      if (userQuery.empty) {
        console.log("❌ Patient not found with patientId:", patientId);
        return;
      }

      const userDoc = userQuery.docs[0];
      const tokens = getActiveTokens(userDoc.data()?.fcmTokens);

      if (tokens.length === 0) {
        console.log("⚠️ No active tokens for patient:", patientId);
        return;
      }

      // ==========================================
      // MONTAR MENSAGEM BASEADA NA MUDANÇA
      // ==========================================
      let title = "";
      let body = "";
      let notificationType = "";

      if (statusChanged) {
        switch (status) {
          case "confirmed":
            title = "✅ Consulta confirmada";
            body = `${doctorName || "Seu médico"} confirmou sua consulta para ${formatDateBR(date)} às ${time}`;
            notificationType = "appointment_confirmed";
            break;

          case "cancelled":
            title = "❌ Consulta cancelada pelo médico";
            body = `${doctorName || "Seu médico"} cancelou a consulta de ${formatDateBR(date)} às ${time}. Entre em contato para reagendar.`;
            notificationType = "appointment_cancelled_by_doctor";
            break;

          case "completed":
            title = "🏁 Consulta realizada";
            body = `Sua consulta com ${doctorName || "o médico"} em ${formatDateBR(date)} foi concluída. Obrigado!`;
            notificationType = "appointment_completed";
            break;

          case "scheduled":
            title = "📋 Consulta agendada";
            body = `Sua consulta com ${doctorName || "o médico"} está agendada para ${formatDateBR(date)} às ${time}`;
            notificationType = "appointment_scheduled";
            break;

          default:
            title = "📋 Atualização no agendamento";
            body = `Seu agendamento foi atualizado para ${formatDateBR(date)} às ${time}`;
            notificationType = "appointment_updated";
        }
      } else if (dateChanged || timeChanged) {
        // Reagendamento pelo médico
        title = "🔄 Consulta reagendada";
        body = `${doctorName || "Seu médico"} reagendou sua consulta para ${formatDateBR(date)} às ${time}`;
        notificationType = "appointment_rescheduled";
      } else if (locationChanged) {
        title = "📍 Local da consulta alterado";
        body = `O local da sua consulta em ${formatDateBR(date)} foi alterado para: ${location}`;
        notificationType = "appointment_location_changed";
      }

      if (!title || !body) {
        console.log("⚠️ Não foi possível montar mensagem");
        return;
      }

      // ==========================================
      // ENVIAR PARA TODOS OS TOKENS ATIVOS
      // ==========================================
      const message = {
        notification: { title, body },
        data: {
          type: notificationType,
          appointmentId: event.params.appointmentId,
          patientId: patientId,
          doctorId: before.doctorId || after.doctorId || "",
          status: status || "",
          date: date || "",
          time: time || "",
          click_action: "/(tabs)/appointments",
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(
        `✅ Notificação enviada para paciente ${patientId}: ` +
          `${response.successCount} sucessos, ${response.failureCount} falhas`,
      );

      // ==========================================
      // LIMPAR TOKENS INVÁLIDOS (opcional, recomendado)
      // ==========================================
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.error(
              `❌ Falha no token ${tokens[idx].slice(0, 15)}...: ${resp.error?.message}`,
            );
          }
        });

        // Remover tokens inválidos do Firestore
        if (failedTokens.length > 0) {
          const updates: Record<string, admin.firestore.FieldValue> = {};
          failedTokens.forEach((t) => {
            updates[`fcmTokens.${t}`] = admin.firestore.FieldValue.delete();
          });
          await userDoc.ref.update(updates);
          console.log(
            `🗑️ ${failedTokens.length} token(s) inválido(s) removido(s)`,
          );
        }
      }
    } catch (error) {
      console.error("❌ Error sending notification to patient:", error);
    }
  },
);

// ============================================
// FUNÇÃO 6: Notificar médico (onCreate)
// ============================================
export const notifyDoctorOnAppointmentCreated = onDocumentCreated(
  "appointments/{appointmentId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const appointment = snapshot.data();
    const { doctorId, patientName, date, time } = appointment;

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
      const title = "🆕 Nova Consulta Agendada";
      const body =
        date === today
          ? `Hoje às ${time} - Paciente: ${patientName}`
          : `${new Date(date).toLocaleDateString("pt-BR")} às ${time} - Paciente: ${patientName}`;

      const message = {
        notification: { title, body },
        data: {
          type: "new_appointment",
          appointmentId: event.params.appointmentId,
          doctorId: doctorId,
          patientName: patientName,
          date: date,
          time: time,
        },
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Notificação enviada para médico ${doctorId}`);
    } catch (error) {
      console.error("❌ Error sending notification to doctor:", error);
    }
  },
);

// ============================================
// FUNÇÃO 7: Validação de conflito (mantida)
// ============================================
export const validateAppointmentConflictCheck = onCall(async (request) => {
  const { doctorId, date, time, duration, excludeAppointmentId } = request.data;

  if (!doctorId || !date || !time || !duration) {
    throw new Error("Missing required fields: doctorId, date, time, duration");
  }

  return await validateAppointmentConflict(
    admin.firestore(),
    doctorId,
    date,
    time,
    duration,
    excludeAppointmentId,
  );
});

// ============================================
// FUNÇÃO 8: Criar agendamento com transação (mantida)
// ============================================
export const createAppointmentWithValidation = onCall(async (request) => {
  const {
    doctorId,
    date,
    time,
    duration,
    patientId,
    patientName,
    patientPhone,
    location,
    notes,
  } = request.data;

  if (!doctorId || !date || !time || !duration || !patientId || !patientName) {
    throw new Error("Missing required fields");
  }

  try {
    const appointmentId = await admin
      .firestore()
      .runTransaction(async (transaction) => {
        const snapshot = await admin
          .firestore()
          .collection("appointments")
          .where("doctorId", "==", doctorId)
          .where("date", "==", date)
          .get();

        const newInterval = calculateAppointmentInterval(time, duration);

        for (const doc of snapshot.docs) {
          const existing = doc.data();
          const existingInterval = calculateAppointmentInterval(
            existing.time,
            existing.duration,
          );

          if (
            hasTimeConflict(
              newInterval.start,
              newInterval.end,
              existingInterval.start,
              existingInterval.end,
            )
          ) {
            throw new Error(
              `Conflito: Já existe agendamento das ${existing.time} às ${minutesToTime(existingInterval.end)}`,
            );
          }
        }

        const newDocRef = admin.firestore().collection("appointments").doc();
        transaction.set(newDocRef, {
          doctorId,
          date,
          time,
          duration,
          patientId,
          patientName,
          patientPhone: patientPhone || "",
          location: location || "Consultório",
          status: "scheduled",
          notes: notes || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return newDocRef.id;
      });

    return { success: true, appointmentId };
  } catch (error) {
    console.error("❌ Erro:", error);
    throw new Error((error as Error).message);
  }
});
