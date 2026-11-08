import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
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

// IDs dos médicos no Firestore
const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";
const DOCTOR_NAME = "Dra. Ana Beatriz Costa";

// Dados de teste para notificação
const TEST_NOTIFICATION = {
  title: "Nova Consulta Agendada",
  body: "Você tem uma nova consulta agendada para hoje às 15:00",
  data: {
    type: "appointment",
    click_action: "/dashboard",
    appointmentId: "test-appointment-123"
  }
};

async function createTestNotification() {
  try {
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    console.log(`📱 Criando notificação para médico: ${DOCTOR_NAME}`);
    console.log(`🆔 Doctor ID: ${DOCTOR_ID}`);

    const notification = {
      doctorId: DOCTOR_ID,
      title: TEST_NOTIFICATION.title,
      body: TEST_NOTIFICATION.body,
      data: TEST_NOTIFICATION.data,
      status: 'pending',
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'notifications'), notification);
    
    console.log('✅ Notificação criada com sucesso!');
    console.log(`📋 ID: ${docRef.id}`);
    console.log(`👨‍⚕️ Médico: ${DOCTOR_NAME}`);
    console.log(`📱 Título: ${TEST_NOTIFICATION.title}`);
    console.log(`📝 Mensagem: ${TEST_NOTIFICATION.body}`);
    console.log(`🎯 Status: pending (Cloud Function processará automaticamente)`);
    
    console.log('\n⏳ Aguardando processamento da Cloud Function...');
    console.log('💡 Verifique os logs: firebase functions:log');
    
    // Monitorar status da notificação
    setTimeout(async () => {
      try {
        const notificationDoc = await doc(db, 'notifications', docRef.id);
        const snapshot = await notificationDoc.get();
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('\n📊 Status atual da notificação:');
          console.log(`   Status: ${data.status}`);
          if (data.sentAt) {
            console.log(`   Enviada em: ${data.sentAt.toDate().toLocaleString('pt-BR')}`);
          }
          if (data.error) {
            console.log(`   Erro: ${data.error}`);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error.message);
      }
    }, 5000); // Verificar após 5 segundos

    return docRef.id;
  } catch (error) {
    console.error('❌ Erro ao criar notificação:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
createTestNotification();
