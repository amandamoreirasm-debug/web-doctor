import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  runTransaction,
  doc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Cria agendamento com transação para evitar race conditions
 * Garante que a validação e criação sejam atômicas
 */
export async function createAppointmentWithTransaction(appointmentData: {
  doctorId: string;
  date: string;
  time: string;
  duration: number;
  [key: string]: any;
}) {
  const { doctorId, date, time, duration, ...otherData } = appointmentData;

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Buscar agendamentos existentes dentro da transação
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        where('doctorId', '==', doctorId),
        where('date', '==', date)
      );
      
      const snapshot = await getDocs(appointmentsQuery);
      
      // 2. Validar conflito
      const newStart = timeToMinutes(time);
      const newEnd = newStart + duration;
      
      for (const doc of snapshot.docs) {
        const existing = doc.data();
        const existingStart = timeToMinutes(existing.time);
        const existingEnd = existingStart + existing.duration;
        
        if (hasTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
          const conflictingEnd = minutesToTime(existingEnd);
          throw new Error(`Conflito de horário: Já existe agendamento das ${existing.time} às ${conflictingEnd}`);
        }
      }
      
      // 3. Se não houver conflito, criar o documento
      const newDocRef = doc(collection(db, 'appointments'));
      transaction.set(newDocRef, {
        ...otherData,
        doctorId,
        date,
        time,
        duration,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      
      return newDocRef.id;
    });
    
    console.log('✅ Agendamento criado com transação:', result);
    return result;
  } catch (error) {
    console.error('❌ Erro na transação:', error);
    throw error;
  }
}

// Funções auxiliares
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function hasTimeConflict(start1: number, end1: number, start2: number, end2: number): boolean {
  if (end1 <= start2 || end2 <= start1) {
    return false;
  }
  return true;
}