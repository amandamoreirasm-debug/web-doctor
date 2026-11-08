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
exports.sendNotification = exports.sendBulkNotifications = exports.sendNotificationToDoctor = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
/**
 * Cloud Function: Enviar notificação para um médico específico
 * Trigger: Quando um documento é criado na coleção 'notifications'
 */
exports.sendNotificationToDoctor = (0, firestore_1.onDocumentCreated)("notifications/{notificationId}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const notification = snapshot.data();
    const { doctorId, title, body, data } = notification;
    if (!doctorId) {
        console.log("No doctorId in notification");
        return;
    }
    try {
        // Buscar o token FCM do médico
        const doctorDoc = await admin
            .firestore()
            .collection("doctors")
            .doc(doctorId)
            .get();
        if (!doctorDoc.exists) {
            console.log("Doctor not found:", doctorId);
            return;
        }
        const doctorData = doctorDoc.data();
        const fcmToken = doctorData === null || doctorData === void 0 ? void 0 : doctorData.fcmToken;
        if (!fcmToken) {
            console.log("No FCM token for doctor:", doctorId);
            return;
        }
        // Configurar a mensagem
        const message = {
            notification: {
                title: title || "Nova notificação",
                body: body || "Você tem uma nova mensagem",
            },
            data: data || {},
            token: fcmToken,
        };
        // Enviar a notificação
        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
        // Atualizar status da notificação
        await snapshot.ref.update({
            status: "sent",
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error("Error sending notification:", error);
        // Atualizar status da notificação como falha
        await snapshot.ref.update({
            status: "failed",
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
/**
 * Cloud Function: Enviar notificação para múltiplos médicos
 * Trigger: HTTP callable function
 */
exports.sendBulkNotifications = (0, https_1.onCall)(async (request) => {
    const { doctorIds, title, body, data } = request.data;
    if (!doctorIds || !Array.isArray(doctorIds) || doctorIds.length === 0) {
        throw new Error("doctorIds must be a non-empty array");
    }
    if (!title || !body) {
        throw new Error("title and body are required");
    }
    const results = {
        success: 0,
        failed: 0,
        errors: [],
    };
    for (const doctorId of doctorIds) {
        try {
            // Buscar o token FCM do médico
            const doctorDoc = await admin
                .firestore()
                .collection("doctors")
                .doc(doctorId)
                .get();
            if (!doctorDoc.exists) {
                results.failed++;
                results.errors.push(`Doctor not found: ${doctorId}`);
                continue;
            }
            const doctorData = doctorDoc.data();
            const fcmToken = doctorData === null || doctorData === void 0 ? void 0 : doctorData.fcmToken;
            if (!fcmToken) {
                results.failed++;
                results.errors.push(`No FCM token for doctor: ${doctorId}`);
                continue;
            }
            // Configurar a mensagem
            const message = {
                notification: {
                    title,
                    body,
                },
                data: data || {},
                token: fcmToken,
            };
            // Enviar a notificação
            await admin.messaging().send(message);
            results.success++;
        }
        catch (error) {
            results.failed++;
            results.errors.push(`Error for doctor ${doctorId}: ${error.message}`);
        }
    }
    return results;
});
/**
 * Cloud Function: Enviar notificação para um médico específico (callable)
 * Trigger: HTTP callable function
 */
exports.sendNotification = (0, https_1.onCall)(async (request) => {
    const { doctorId, title, body, data } = request.data;
    if (!doctorId) {
        throw new Error("doctorId is required");
    }
    if (!title || !body) {
        throw new Error("title and body are required");
    }
    try {
        // Buscar o token FCM do médico
        const doctorDoc = await admin
            .firestore()
            .collection("doctors")
            .doc(doctorId)
            .get();
        if (!doctorDoc.exists) {
            throw new Error("Doctor not found");
        }
        const doctorData = doctorDoc.data();
        const fcmToken = doctorData === null || doctorData === void 0 ? void 0 : doctorData.fcmToken;
        if (!fcmToken) {
            throw new Error("No FCM token for this doctor");
        }
        // Configurar a mensagem
        const message = {
            notification: {
                title,
                body,
            },
            data: data || {},
            token: fcmToken,
        };
        // Enviar a notificação
        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
        return { success: true, messageId: response };
    }
    catch (error) {
        console.error("Error sending notification:", error);
        throw new Error(error.message);
    }
});
//# sourceMappingURL=index.js.map