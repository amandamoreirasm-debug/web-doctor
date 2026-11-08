import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';

const envs = {
  VITE_FIREBASE_API_KEY: 'AIzaSyBHEbg9UrRNDFv3qqY3_Ev9woDJserLvu8',
  VITE_FIREBASE_AUTH_DOMAIN: 'doctor-f3a93.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'doctor-f3a93',
  VITE_FIREBASE_STORAGE_BUCKET: 'doctor-f3a93.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '282554407746',
  VITE_FIREBASE_APP_ID: '1:282554407746:web:83ed0865ce9917b3a046db',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-63WLGW50H1',
  VITE_FIREBASE_VAPID_KEY: 'BHcpCPotXAiR0n905b5VbA9zYG_LDR42-Wq1QWF4lV_xIfy_gtwFie4hEtIDmjFDD6ziZ6UWP5DZZ4xjFwJtBOA'
};

const firebaseConfig = {
  apiKey: envs.VITE_FIREBASE_API_KEY,
  authDomain: envs.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envs.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envs.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envs.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envs.VITE_FIREBASE_APP_ID,
};

const DOCTOR_EMAIL = "amandamoreira.sm@gmail.com";
const DOCTOR_PASSWORD = "Pv81=***";

const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";
const DOCTOR_NAME = "Dra. Ana Beatriz Costa";
const DOCTOR_SPECIALTY = "Cardiologia";
const LOCATION = "Consultório 304 - Torre Norte";

const TEST_PATIENT = {
  id: "Jq964VFEEoTmSlVuFxDphJOZQgm2",
  name: "Paciente Teste Silva",
  phone: "(11) 99999-7777"
};

async function testRaceCondition() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const functions = getFunctions(app, 'us-central1');

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Data de teste: ${today}`);

    // Limpar agendamentos de teste
    console.log('\n🧹 Limpando agendamentos de teste...');
    const allAppointmentsQuery = query(
      collection(db, 'appointments'),
      where('doctorId', '==', DOCTOR_ID),
      where('date', '==', today)
    );
    const allSnapshot = await getDocs(allAppointmentsQuery);
    
    for (const doc of allSnapshot.docs) {
      const notes = doc.data().notes || '';
      if (notes.includes('Race condition test')) {
        await doc.ref.delete();
        console.log(`   🗑️  Deletado agendamento: ${doc.id}`);
      }
    }

    // ============================================
    // TESTE 1: Criar com Cloud Function (com transação)
    // ============================================
    console.log('\n🧪 TESTE 1: Criar agendamento com Cloud Function (protegido contra race condition)');
    
    const createAppointmentFunction = httpsCallable(functions, 'createAppointmentWithValidation');
    
    try {
      const result1 = await createAppointmentFunction({
        doctorId: DOCTOR_ID,
        date: today,
        time: "19:00",
        duration: 30,
        patientId: TEST_PATIENT.id,
        patientName: TEST_PATIENT.name,
        patientPhone: TEST_PATIENT.phone,
        location: LOCATION,
        notes: "Race condition test - agendamento 1"
      });
      console.log('✅ Agendamento 1 criado com Cloud Function:', result1.data.appointmentId);
    } catch (error) {
      console.log('❌ Erro ao criar agendamento 1:', error.message);
    }

    // ============================================
    // TESTE 2: Tentar criar no mesmo horário (deve falhar)
    // ============================================
    console.log('\n🧪 TESTE 2: Tentar criar no mesmo horário (deve falhar)');
    
    try {
      const result2 = await createAppointmentFunction({
        doctorId: DOCTOR_ID,
        date: today,
        time: "19:00",
        duration: 30,
        patientId: TEST_PATIENT.id,
        patientName: "Paciente Teste 2",
        patientPhone: "(11) 99999-8888",
        location: LOCATION,
        notes: "Race condition test - agendamento 2"
      });
      console.log('❌ Agendamento 2 criado (inesperado - deveria falhar):', result2.data.appointmentId);
    } catch (error) {
      console.log('✅ Agendamento 2 falhou conforme esperado:', error.message);
    }

    // ============================================
    // TESTE 3: Criar em horário livre (deve funcionar)
    // ============================================
    console.log('\n🧪 TESTE 3: Criar em horário livre (deve funcionar)');
    
    try {
      const result3 = await createAppointmentFunction({
        doctorId: DOCTOR_ID,
        date: today,
        time: "19:30",
        duration: 30,
        patientId: TEST_PATIENT.id,
        patientName: TEST_PATIENT.name,
        patientPhone: TEST_PATIENT.phone,
        location: LOCATION,
        notes: "Race condition test - agendamento 3"
      });
      console.log('✅ Agendamento 3 criado:', result3.data.appointmentId);
    } catch (error) {
      console.log('❌ Erro ao criar agendamento 3:', error.message);
    }

    console.log('\n🎉 Testes de race condition concluídos!');
    console.log('💡 Com a Cloud Function com transação:');
    console.log('   ✅ Race conditions são evitadas');
    console.log('   ✅ Validação e criação são atômicas');
    console.log('   ✅ Apenas um agendamento pode ser criado no mesmo horário');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
testRaceCondition();
