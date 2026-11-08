import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, Timestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const envs = {
  VITE_FIREBASE_API_KEY: 'AIzaSyBHEbg9UrRNDFv3qqY3_Ev9woDJserLvu8',
  VITE_FIREBASE_AUTH_DOMAIN: 'doctor-f3a93.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'doctor-f3a93',
  VITE_FIREBASE_STORAGE_BUCKET: 'doctor-f3a93.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '282554407746',
  VITE_FIREBASE_APP_ID: '1:282554407746:web:83ed0865ce9917b3a046db',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-63WLGW50H1',
  VITE_FIREBASE_VAPID_KEY: 'BHcpCPotXAiR0n905b5VbA9zYG_LDR42-Wq1QWF4lV_xIfy_gtwFie4hEtIDmjFDD6ziZ6UWP5DZZ4xjFwJtBOA'
}

const firebaseConfig = {
  apiKey: envs.VITE_FIREBASE_API_KEY,
  authDomain: envs.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envs.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envs.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envs.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envs.VITE_FIREBASE_APP_ID,
};

// Credenciais do médico (para autenticação)
const DOCTOR_EMAIL = "amandamoreira.sm@gmail.com";
const DOCTOR_PASSWORD = "Pv81=***";

// ID do agendamento para cancelar (altere conforme necessário)
// Se não fornecer, buscará o agendamento mais recente
const APPOINTMENT_ID = process.argv[2] || null;
const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";

// Função para buscar o agendamento mais recente
async function getLatestAppointment(db, doctorId) {
  const q = query(
    collection(db, 'appointments'),
    where('doctorId', '==', doctorId),
    where('status', '==', 'scheduled'),
    orderBy('date', 'desc'),
    orderBy('time', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0];
}

async function cancelAppointmentByPatient() {
  try {
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    let appointmentDoc;

    if (!APPOINTMENT_ID) {
      console.log('🔍 Buscando agendamento mais recente...');
      const latestAppointment = await getLatestAppointment(db, DOCTOR_ID);

      if (!latestAppointment) {
        console.error('❌ Nenhum agendamento encontrado para cancelar');
        return;
      }

      appointmentDoc = latestAppointment;
      console.log(`📋 Agendamento encontrado: ${appointmentDoc.id}`);
    } else {
      console.log(`🔄 Cancelando agendamento ${APPOINTMENT_ID} como paciente...`);
      // Buscar o agendamento atual
      const appointmentRef = doc(db, 'appointments', APPOINTMENT_ID);
      appointmentDoc = await getDoc(appointmentRef);

      if (!appointmentDoc.exists()) {
        console.error('❌ Agendamento não encontrado:', APPOINTMENT_ID);
        return;
      }
    }

    const appointmentData = appointmentDoc.data();
    console.log('📋 Agendamento atual:', {
      id: appointmentDoc.id,
      patientName: appointmentData.patientName,
      date: appointmentData.date,
      time: appointmentData.time,
      currentStatus: appointmentData.status
    });

    // Atualizar status para patient_cancelled
    await updateDoc(doc(db, 'appointments', appointmentDoc.id), {
      status: 'patient_cancelled',
      cancelledAt: Timestamp.now(),
      cancellationReason: 'Cancelado pelo paciente',
      updatedAt: Timestamp.now()
    });

    console.log('✅ Agendamento cancelado pelo paciente com sucesso!');
    console.log(`📋 Status alterado para: patient_cancelled`);
    console.log(`📱 Notificação será enviada para o médico automaticamente`);
    console.log(`🕐 O slot deve aparecer como "Livre" na agenda`);

    return appointmentDoc.id;
  } catch (error) {
    console.error('❌ Erro ao cancelar agendamento:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
cancelAppointmentByPatient();
