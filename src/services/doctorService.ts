import { db, functions } from "../firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Doctor } from "../types";
import { httpsCallable } from "firebase/functions";

const COLLECTION = "doctors";

const firestoreToDoctor = (doc: any): Doctor => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
  };
};

// Buscar médico por ID
export async function fetchDoctorById(
  doctorId: string,
): Promise<Doctor | null> {
  const ref = doc(db, COLLECTION, doctorId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  return firestoreToDoctor(snapshot);
}

// Buscar todos os médicos (para admin/supervisão)
export async function fetchAllDoctors(): Promise<Doctor[]> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(firestoreToDoctor);
}

// Buscar médico por email (para login/associação)
export async function fetchDoctorByEmail(
  email: string,
): Promise<Doctor | null> {
  const q = query(collection(db, COLLECTION), where("email", "==", email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return firestoreToDoctor(snapshot.docs[0]);
}

export async function registerDoctorToken(token: string, doctorId: string) {
  const registerToken = httpsCallable(functions, "registerDoctorToken");
  const device = navigator.userAgent.includes("Mobile") ? "Mobile" : "Web";
  const result = await registerToken({ doctorId, token, device });
  console.log("✅ Token registrado via Cloud Function:", result.data);
  return result.data;
}

// Criar médico
export async function createDoctor(
  uid: string,
  data: Partial<Doctor>,
): Promise<void> {
  try {
    const doctorRef = doc(db, "doctors", uid);
    await setDoc(doctorRef, {
      ...data,
      doctorId: uid, // Adicionar campo doctorId para consistência nas queries
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fcmTokens: {}, // Inicializar objeto de tokens
    });
    console.log("✅ Médico criado com sucesso");
  } catch (error) {
    console.error("❌ Erro ao criar médico:", error);
    throw error;
  }
}

// Buscar médico por email

// Atualizar médico
export async function updateDoctor(
  uid: string,
  data: Partial<Doctor>,
): Promise<void> {
  try {
    const doctorRef = doc(db, "doctors", uid);
    await updateDoc(doctorRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar médico:", error);
    throw error;
  }
}
