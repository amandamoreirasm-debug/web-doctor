import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
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

// Dados fornecidos pelo usuário
const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";
const FCM_TOKEN = "fOiv9bHguiFPlk3MboQgW8:APA91bFqwDX7_5ZjXZ4bN-BqNK0Wv44X7oj0i-IGjuOgyGuQ0TaYkv_E8I2bnx8stPbFCeX0wkbcqlGSVCUtKcdm2FTuGsH2crg3z4H3bvzy1saWhwKvKz4";

// Tente buscar por email como fallback
const DOCTOR_EMAIL_FALLBACK = "amandamoreira.sm@gmail.com";

async function updateFCMToken() {
  try {
    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    console.log(`📱 Atualizando FCM Token para médico ID: ${DOCTOR_ID}`);
    console.log(`🔑 Token: ${FCM_TOKEN.substring(0, 50)}...`);

    // Verificar se o médico existe - buscar pelo campo doctorId
    const doctorsQuery = query(
      collection(db, 'doctors'),
      where('doctorId', '==', DOCTOR_ID)
    );
    const querySnapshot = await getDocs(doctorsQuery);
    
    let doctorRef, doctorDoc;
    
    if (querySnapshot.empty) {
      console.log('⚠️ Médico não encontrado pelo doctorId, tentando buscar por email...');
      
      // Tentar buscar por email como fallback
      const emailQuery = query(
        collection(db, 'doctors'),
        where('email', '==', DOCTOR_EMAIL_FALLBACK)
      );
      const emailQuerySnapshot = await getDocs(emailQuery);
      
      if (emailQuerySnapshot.empty) {
        console.log('⚠️ Médico não encontrado pelo email também, criando documento...');
        
        // Criar o documento do médico com o ID fornecido
        await setDoc(doc(db, 'doctors', DOCTOR_ID), {
          doctorId: DOCTOR_ID,
          email: DOCTOR_EMAIL_FALLBACK,
          name: "Dra. Amanda Moreira",
          specialty: "Cardiologia",
          fcmToken: FCM_TOKEN,
          fcmTokenUpdatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
        
        console.log('✅ Documento do médico criado com sucesso!');
        console.log(`👨‍⚕️ Nome: Dra. Amanda Moreira`);
        console.log(`📧 Email: ${DOCTOR_EMAIL_FALLBACK}`);
        console.log(`🆔 ID: ${DOCTOR_ID}`);
        console.log('\n💡 Agora você pode testar notificações usando:');
        console.log('   npm run create:notification');
        return;
      }
      
      const foundDoc = emailQuerySnapshot.docs[0];
      doctorRef = foundDoc.ref;
      doctorDoc = foundDoc;
      console.log(`✅ Médico encontrado por email! ID real: ${foundDoc.id}`);
    } else {
      const foundDoc = querySnapshot.docs[0];
      doctorRef = foundDoc.ref;
      doctorDoc = foundDoc;
      console.log(`✅ Médico encontrado por doctorId! ID real: ${foundDoc.id}`);
    }

    const doctorData = doctorDoc.data();
    console.log(`👨‍⚕️ Médico encontrado: ${doctorData.name || doctorData.email}`);

    // Atualizar o FCM token
    await updateDoc(doctorRef, {
      fcmToken: FCM_TOKEN,
      fcmTokenUpdatedAt: new Date().toISOString(),
    });

    console.log('✅ FCM Token atualizado com sucesso!');
    console.log(`📅 Atualizado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log('\n💡 Agora você pode testar notificações usando:');
    console.log('   node create-notification.js');

  } catch (error) {
    console.error('❌ Erro ao atualizar FCM Token:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
updateFCMToken();
