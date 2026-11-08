"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointmentWithValidation = exports.validateAppointmentConflictCheck = exports.notifyDoctorOnAppointmentCreated = exports.notifyPatientOnAppointmentUpdate = exports.notifyDoctorOnPatientCancellation = exports.sendBulkNotifications = exports.sendNotification = exports.sendNotificationToDoctor = exports.registerDoctorToken = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
// ============================================
// FUNÇÃO AUXILIAR: Extrair tokens ativos
// ============================================
function getActiveTokens(fcmTokens) {
    if (!fcmTokens || typeof fcmTokens !== "object")
        return [];
    const tokens = [];
    const now = new Date();
    const maxAgeDays = 30;
    for (const [token, info] of Object.entries(fcmTokens)) {
        if (!token || typeof token !== "string" || token.length < 10)
            continue;
        const tokenData = info;
        const lastUsed = tokenData.lastUsed ? new Date(tokenData.lastUsed) : null;
        if (lastUsed) {
            const daysSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastUse > maxAgeDays)
                continue;
        }
        tokens.push(token);
    }
    return tokens;
}
// ============================================
// Utilitários de validação de horário (mantidos)
// ============================================
function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}
function hasTimeConflict(start1, end1, start2, end2) {
    return !(end1 <= start2 || end2 <= start1);
}
function calculateAppointmentInterval(time, duration) {
    const start = timeToMinutes(time);
    return { start, end: start + duration };
}
async function validateAppointmentConflict(db, doctorId, date, time, duration, excludeAppointmentId) {
    const snapshot = await db
        .collection("appointments")
        .where("doctorId", "==", doctorId)
        .where("date", "==", date)
        .get();
    if (snapshot.empty)
        return { valid: true };
    const newInterval = calculateAppointmentInterval(time, duration);
    for (const doc of snapshot.docs) {
        if (excludeAppointmentId && doc.id === excludeAppointmentId)
            continue;
        const existing = doc.data();
        const existingInterval = calculateAppointmentInterval(existing.time, existing.duration);
        if (hasTimeConflict(newInterval.start, newInterval.end, existingInterval.start, existingInterval.end)) {
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
exports.registerDoctorToken = (0, https_1.onCall)(async (request) => {
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
    }
    catch (error) {
        console.error("❌ Erro ao registrar token:", error);
        throw new Error(error.message);
    }
});
// ============================================
// FUNÇÃO 1: Notificação para médico (trigger)
// ============================================
exports.sendNotificationToDoctor = (0, firestore_1.onDocumentCreated)("notifications/{notificationId}", async (event) => {
    var _a;
    const snapshot = event.data;
    if (!snapshot)
        return;
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
        const tokens = getActiveTokens((_a = doctorDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
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
        console.log(`✅ Enviado: ${response.successCount} sucessos, ${response.failureCount} falhas`);
        await snapshot.ref.update({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            recipientCount: tokens.length,
        });
    }
    catch (error) {
        console.error("❌ Error:", error);
        await snapshot.ref.update({
            status: "failed",
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
// ============================================
// FUNÇÃO 2: Notificação para médico (callable)
// ============================================
exports.sendNotification = (0, https_1.onCall)(async (request) => {
    var _a;
    const { doctorId, title, body, data } = request.data;
    if (!doctorId)
        throw new Error("doctorId is required");
    if (!title || !body)
        throw new Error("title and body are required");
    // Query by doctorId field instead of document ID
    const doctorQuery = await admin
        .firestore()
        .collection("doctors")
        .where("doctorId", "==", doctorId)
        .limit(1)
        .get();
    if (doctorQuery.empty)
        throw new Error("Doctor not found");
    const doctorDoc = doctorQuery.docs[0];
    const tokens = getActiveTokens((_a = doctorDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
    if (tokens.length === 0)
        throw new Error("No active FCM tokens");
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
exports.sendBulkNotifications = (0, https_1.onCall)(async (request) => {
    var _a;
    const { doctorIds, title, body, data } = request.data;
    if (!doctorIds || !Array.isArray(doctorIds) || doctorIds.length === 0) {
        throw new Error("doctorIds must be a non-empty array");
    }
    if (!title || !body)
        throw new Error("title and body are required");
    const results = {
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
            const tokens = getActiveTokens((_a = doctorDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
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
        }
        catch (error) {
            results.failed++;
            results.errors.push(`Error for ${doctorId}: ${error.message}`);
        }
    }
    return results;
});
// ============================================
// FUNÇÃO 4: Notificar médico quando paciente cancelar (onUpdate)
// ============================================
exports.notifyDoctorOnPatientCancellation = (0, firestore_1.onDocumentUpdated)("appointments/{appointmentId}", async (event) => {
    var _a;
    const { data } = event;
    if (!data)
        return;
    const before = data.before.data();
    const after = data.after.data();
    // Verificar se o status mudou para patient_cancelled
    const statusChangedToPatientCancelled = before.status !== "patient_cancelled" &&
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
        const tokens = getActiveTokens((_a = doctorDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
        if (tokens.length === 0) {
            console.log("⚠️ No active tokens for doctor:", doctorId);
            return;
        }
        const today = new Date().toISOString().split("T")[0];
        const title = "❌ Paciente Cancelou Consulta";
        const body = date === today
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
        console.log(`✅ Notificação enviada para médico ${doctorId} sobre cancelamento do paciente`);
    }
    catch (error) {
        console.error("❌ Error sending notification to doctor about patient cancellation:", error);
    }
});
// ============================================
// FUNÇÃO 5: Notificar paciente (onUpdate)
// ============================================
exports.notifyPatientOnAppointmentUpdate = (0, firestore_1.onDocumentUpdated)("appointments/{appointmentId}", async (event) => {
    var _a;
    const { data } = event;
    if (!data)
        return;
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
        const tokens = getActiveTokens((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
        if (tokens.length === 0) {
            console.log("⚠️ No active tokens for patient:", patientId);
            return;
        }
        let title = "Atualização no Agendamento";
        let body = "";
        if (statusChanged) {
            const statusMessages = {
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
        }
        else if (dateChanged || timeChanged) {
            title = "🔄 Horário alterado";
            body = `Seu agendamento foi alterado para ${date} às ${time}`;
        }
        if (!title || !body)
            return;
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
    }
    catch (error) {
        console.error("❌ Error sending notification to patient:", error);
    }
});
// ============================================
// FUNÇÃO 6: Notificar médico (onCreate)
// ============================================
exports.notifyDoctorOnAppointmentCreated = (0, firestore_1.onDocumentCreated)("appointments/{appointmentId}", async (event) => {
    var _a;
    const snapshot = event.data;
    if (!snapshot)
        return;
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
        const tokens = getActiveTokens((_a = doctorDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens);
        if (tokens.length === 0) {
            console.log("⚠️ No active tokens for doctor:", doctorId);
            return;
        }
        const today = new Date().toISOString().split("T")[0];
        const title = "🆕 Nova Consulta Agendada";
        const body = date === today
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
    }
    catch (error) {
        console.error("❌ Error sending notification to doctor:", error);
    }
});
// ============================================
// FUNÇÃO 7: Validação de conflito (mantida)
// ============================================
exports.validateAppointmentConflictCheck = (0, https_1.onCall)(async (request) => {
    const { doctorId, date, time, duration, excludeAppointmentId } = request.data;
    if (!doctorId || !date || !time || !duration) {
        throw new Error("Missing required fields: doctorId, date, time, duration");
    }
    return await validateAppointmentConflict(admin.firestore(), doctorId, date, time, duration, excludeAppointmentId);
});
// ============================================
// FUNÇÃO 8: Criar agendamento com transação (mantida)
// ============================================
exports.createAppointmentWithValidation = (0, https_1.onCall)(async (request) => {
    const { doctorId, date, time, duration, patientId, patientName, patientPhone, location, notes, } = request.data;
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
                const existingInterval = calculateAppointmentInterval(existing.time, existing.duration);
                if (hasTimeConflict(newInterval.start, newInterval.end, existingInterval.start, existingInterval.end)) {
                    throw new Error(`Conflito: Já existe agendamento das ${existing.time} às ${minutesToTime(existingInterval.end)}`);
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
    }
    catch (error) {
        console.error("❌ Erro:", error);
        throw new Error(error.message);
    }
});
//# sourceMappingURL=index.js.map