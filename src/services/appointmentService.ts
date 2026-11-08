import { db } from "../firebase/config";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";
import type { Appointment } from "../types";

const COLLECTION = "appointments";

// Converter Appointment para documento Firestore
const appointmentToFirestore = (apt: Omit<Appointment, "id">) => ({
  ...apt,
  createdAt: Timestamp.fromDate(new Date(apt.createdAt)),
  updatedAt: Timestamp.fromDate(new Date(apt.updatedAt)),
  cancelledAt: apt.cancelledAt
    ? Timestamp.fromDate(new Date(apt.cancelledAt))
    : null,
  confirmedAt: apt.confirmedAt
    ? Timestamp.fromDate(new Date(apt.confirmedAt))
    : null,
  completedAt: apt.completedAt
    ? Timestamp.fromDate(new Date(apt.completedAt))
    : null,
});

// Converter documento Firestore para Appointment
const firestoreToAppointment = (doc: any): Appointment => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt:
      data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt:
      data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    cancelledAt: data.cancelledAt?.toDate?.()?.toISOString(),
    confirmedAt: data.confirmedAt?.toDate?.()?.toISOString(),
    completedAt: data.completedAt?.toDate?.()?.toISOString(),
  };
};

// Buscar agendamentos de um médico para uma data específica
export async function fetchDoctorAppointments(
  doctorId: string,
  date: string,
): Promise<Appointment[]> {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("date", "==", date),
    orderBy("time"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(firestoreToAppointment);
}

export async function fetchDoctorAppointmentsByDateRange(
  doctorId: string,
  startDate: string,
  endDate: string,
): Promise<Appointment[]> {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date"),
    orderBy("time"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(firestoreToAppointment);
}

// Buscar histórico completo do médico
export async function fetchDoctorHistory(
  doctorId: string,
): Promise<Appointment[]> {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("status", "in", ["completed", "cancelled", "patient_cancelled"]),
    orderBy("date", "desc"),
    orderBy("time", "desc"),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(firestoreToAppointment);
}

// Atualizar status de um agendamento (com transaction para consistência)
export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: Appointment["status"],
  cancellationReason?: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, appointmentId);

  await runTransaction(db, async (transaction) => {
    const aptDoc = await transaction.get(ref);
    if (!aptDoc.exists()) {
      throw new Error("Agendamento não encontrado");
    }

    const updates: any = {
      status: newStatus,
      updatedAt: Timestamp.now(),
    };

    if (newStatus === "confirmed") {
      updates.confirmedAt = Timestamp.now();
    }
    if (newStatus === "completed") {
      updates.completedAt = Timestamp.now();
    }
    if (newStatus === "cancelled" || newStatus === "patient_cancelled") {
      updates.cancelledAt = Timestamp.now();
      updates.cancellationReason = cancellationReason || null;
    }

    transaction.update(ref, updates);
  });
}

// Escutar mudanças em tempo real (para atualização automática da UI)
export function subscribeToDoctorAppointments(
  doctorId: string,
  date: string,
  callback: (appointments: Appointment[]) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("date", "==", date),
    orderBy("time"),
  );

  return onSnapshot(q, (snapshot) => {
    const appointments = snapshot.docs.map(firestoreToAppointment);
    callback(appointments);
  });
}

// Criar novo agendamento (usado quando paciente agenda via mobile)
export async function createAppointment(
  appointment: Omit<Appointment, "id">,
): Promise<string> {
  const docRef = await addDoc(
    collection(db, COLLECTION),
    appointmentToFirestore(appointment),
  );
  return docRef.id;
}

export function subscribeToDoctorAppointmentsByDateRange(
  doctorId: string,
  startDate: string,
  endDate: string,
  callback: (appointments: Appointment[]) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("date", ">=", startDate),
    where("date", "<=", endDate),
    orderBy("date"),
    orderBy("time"),
  );

  return onSnapshot(q, (snapshot) => {
    const appointments = snapshot.docs.map(firestoreToAppointment);
    callback(appointments);
  });
}

// Versão com real-time (se quiser atualização automática)
export function subscribeToDoctorHistory(
  doctorId: string,
  callback: (appointments: Appointment[]) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where("doctorId", "==", doctorId),
    where("status", "in", ["completed", "cancelled"]),
    orderBy("date", "desc"),
    orderBy("time", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    const appointments = snapshot.docs.map(firestoreToAppointment);
    callback(appointments);
  });
}
