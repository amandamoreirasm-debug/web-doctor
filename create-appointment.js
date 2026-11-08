import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
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

// Use environment variables from .env (Vite-style names are reused here)
const firebaseConfig = {
  apiKey: envs.VITE_FIREBASE_API_KEY,
  authDomain: envs.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envs.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envs.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envs.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envs.VITE_FIREBASE_APP_ID,
};

// Credenciais do médico (para autenticação) — coloque em .env para segurança
const DOCTOR_EMAIL = "amandamoreira.sm@gmail.com";
const DOCTOR_PASSWORD = "Pv81=***";

// Dados do paciente de teste
const TEST_PATIENT = {
  id: "Jq964VFEEoTmSlVuFxDphJOZQgm2",
  name: "Paciente Teste Silva",
  phone: "(11) 99999-7777"
};

// IDs dos médicos no Firestore
const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";
const DOCTOR_NAME = "Dra. Ana Beatriz Costa";
const DOCTOR_SPECIALTY = "Cardiologia";
const LOCATION = "Consultório 304 - Torre Norte";

// Calcular próxima hora
const getNextHourSlot = () => {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  
  // Se já passou das 18h, agendar para amanhã 9h
  if (nextHour.getHours() >= 19) {
    nextHour.setDate(now.getDate() + 1);
    nextHour.setHours(9, 0, 0, 0);
  }
  
  const date = nextHour.toISOString().split('T')[0];
  const time = nextHour.toISOString().split('T')[1].slice(0, 5);
  
  return { date, time, datetime: nextHour };
};

// Função para converter hora em minutos
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Função para verificar conflito de horário
function hasTimeConflict(start1, end1, start2, end2) {
  if (end1 <= start2 || end2 <= start1) {
    return false;
  }
  return true;
}

// Função para validar conflito de agendamento
async function validateAppointmentConflict(db, doctorId, date, time, duration) {
  // console.log(`🔍 Validando conflito para: ${date} às ${time} (${duration}min)`);
  
  // Buscar agendamentos do mesmo médico e mesmo dia
  const appointmentsQuery = query(
    collection(db, 'appointments'),
    where('doctorId', '==', doctorId),
    where('date', '==', date)
  );
  
  const snapshot = await getDocs(appointmentsQuery);
  
  if (snapshot.empty) {
    console.log('✅ Nenhum agendamento encontrado para este dia/horário');
    return { valid: true };
  }
  
  // Calcular intervalo do novo agendamento
  const newStart = timeToMinutes(time);
  const newEnd = newStart + duration;
  
  console.log(`📊 Novo agendamento: ${newStart}min → ${newEnd}min (${time} → ${Math.floor(newEnd/60)}:${(newEnd%60).toString().padStart(2,'0')})`);
  
  // Verificar conflito com cada agendamento existente
  for (const doc of snapshot.docs) {
    const existing = doc.data();
    const existingStart = timeToMinutes(existing.time);
    const existingEnd = existingStart + existing.duration;
    
    console.log(`   Agendamento existente: ${existingStart}min → ${existingEnd}min (${existing.time} → ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')})`);
    
    if (hasTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
      const conflictingEnd = `${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}`;
      return {
        valid: false,
        error: `Conflito de horário: Já existe agendamento das ${existing.time} às ${conflictingEnd}`
      };
    }
  }
  
  console.log('✅ Sem conflitos de horário');
  return { valid: true };
}

async function createTestAppointment() {
  try {
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    const { date, time, datetime } = {
      date: new Date().toISOString().split('T')[0],
      time: "10:00",
      datetime: new Date("2026-09-29T11:00:00")
    }
    
    console.log(`📅 Criando agendamento para: ${date} às ${time}`);
    console.log(`⏰ (${datetime.toLocaleString('pt-BR')})`);

    // Validar conflito de horário antes de criar
    const validation = await validateAppointmentConflict(db, DOCTOR_ID, date, time, 30);
    
    if (!validation.valid) {
      console.error('❌ Validação falhou:', validation.error);
      return;
    }
    
    console.log('✅ Validação de horário passou com sucesso');

    const appointment = {
      doctorId: DOCTOR_ID,
      doctorName: DOCTOR_NAME,
      doctorSpecialty: DOCTOR_SPECIALTY,
      patientId: TEST_PATIENT.id,
      patientName: TEST_PATIENT.name,
      patientPhone: TEST_PATIENT.phone,
      date: date,
      time: time,
      duration: 30,
      location: LOCATION,
      status: 'scheduled',
      notes: 'Agendamento de teste para notificações',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'appointments'), appointment);
    
    console.log('✅ Agendamento criado com sucesso!');
    console.log(`📋 ID: ${docRef.id}`);
    console.log(`👨‍⚕️ Médico: ${DOCTOR_NAME}`);
    console.log(`👤 Paciente: ${TEST_PATIENT.name}`);
    console.log(`📅 Data/Hora: ${date} ${time}`);
    
    // A Cloud Function notifyDoctorOnAppointmentCreated é acionada automaticamente
    // e envia notificação para o médico com mensagem baseada na data:
    // - Se for hoje: "Nova consulta hoje às [hora] - Paciente: [nome]"
    // - Se for outra data: "Nova consulta em [data] às [hora] - Paciente: [nome]"
    console.log('📱 Cloud Function enviando notificação automática para o médico...');
    
    // Aguardar um momento para a notificação ser processada
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('💡 Verifique os logs da Cloud Function:');
    console.log('   firebase functions:log');
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao criar agendamento:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
createTestAppointment();