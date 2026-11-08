import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

// Dados de teste para simular atualização
const APPOINTMENT_ID = "test-appointment-123"; // Substitua por um ID real se tiver
const PATIENT_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2"; // ID do paciente
const PATIENT_FCM_TOKEN = "TEST_PATIENT_FCM_TOKEN"; // Token do paciente (simulado)

async function createTestUserAndAppointment() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    // 1. Criar usuário paciente com FCM token
    console.log('\n👤 Criando usuário paciente com FCM token...');
    
    // Verificar se usuário já existe
    const usersQuery = query(
      collection(db, 'users'),
      where('id', '==', PATIENT_ID)
    );
    const userSnapshot = await getDocs(usersQuery);
    
    if (userSnapshot.empty) {
      console.log('⚠️ Usuário não encontrado, criando novo...');
      await db.collection('users').add({
        id: PATIENT_ID,
        name: "Paciente Teste Silva",
        email: "paciente.teste@example.com",
        fcmToken: PATIENT_FCM_TOKEN,
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Usuário paciente criado com FCM token!');
    } else {
      console.log('✅ Usuário paciente já existe, atualizando FCM token...');
      const userDoc = userSnapshot.docs[0];
      await updateDoc(userDoc.ref, {
        fcmToken: PATIENT_FCM_TOKEN,
        fcmTokenUpdatedAt: new Date().toISOString(),
      });
      console.log('✅ FCM token atualizado!');
    }

    // 2. Criar agendamento de teste
    console.log('\n📅 Criando agendamento de teste...');
    
    const appointmentData = {
      doctorId: "pVDfU9kDhAeCg1FyWaScUXugIym2",
      doctorName: "Dra. Ana Beatriz Costa",
      patientId: PATIENT_ID,
      patientName: "Paciente Teste Silva",
      date: "2026-08-18",
      time: "15:00",
      location: "Consultório 304",
      status: "scheduled",
      createdAt: new Date().toISOString(),
    };

    const appointmentRef = await db.collection('appointments').add(appointmentData);
    console.log(`✅ Agendamento criado! ID: ${appointmentRef.id}`);

    // 3. Aguardar um momento
    console.log('\n⏳ Aguardando 3 segundos antes de atualizar...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Atualizar o agendamento (isso deve acionar a Cloud Function)
    console.log('\n🔄 Atualizando agendamento (status -> confirmed)...');
    await updateDoc(appointmentRef, {
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ Agendamento atualizado!');
    console.log('📱 Cloud Function deve enviar notificação para o paciente agora');

    // 5. Monitorar notificações enviadas
    console.log('\n⏳ Aguardando 5 segundos para verificar notificação...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const notificationsQuery = query(
      collection(db, 'patient_notifications'),
      where('appointmentId', '==', appointmentRef.id)
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);

    if (!notificationsSnapshot.empty) {
      console.log('\n📊 Notificação registrada:');
      const notification = notificationsSnapshot.docs[0].data();
      console.log(`   Título: ${notification.title}`);
      console.log(`   Mensagem: ${notification.body}`);
      console.log(`   Status: ${notification.status}`);
      console.log(`   Tipo: ${notification.type}`);
      if (notification.error) {
        console.log(`   Erro: ${notification.error}`);
      }
    } else {
      console.log('\n⚠️ Nenhuma notificação registrada ainda (pode estar processando)');
    }

    console.log('\n💡 Verifique os logs da Cloud Function:');
    console.log('   firebase functions:log');

    return appointmentRef.id;
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
createTestUserAndAppointment();
