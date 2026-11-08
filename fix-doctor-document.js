import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

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

// Doctor information from Firestore
const DOCTOR_DOCUMENT_ID = "S52IbbC1HOvk4jN8Fn7q";
const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";

async function fixDoctorDocument() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('🔍 Verificando documento do médico...');

    // Get the doctor document by document ID
    const doctorRef = doc(db, 'doctors', DOCTOR_DOCUMENT_ID);
    const doctorDoc = await getDoc(doctorRef);

    if (!doctorDoc.exists()) {
      console.error('❌ Documento do médico não encontrado:', DOCTOR_DOCUMENT_ID);
      return;
    }

    const doctorData = doctorDoc.data();
    console.log('📋 Dados atuais do médico:', {
      documentId: doctorDoc.id,
      doctorId: doctorData.doctorId,
      email: doctorData.email,
      name: doctorData.name,
      hasFcmTokens: !!doctorData.fcmTokens,
      fcmTokensCount: doctorData.fcmTokens ? Object.keys(doctorData.fcmTokens).length : 0
    });

    // Check if doctorId field exists and matches
    if (!doctorData.doctorId) {
      console.log('⚠️ Campo doctorId não encontrado. Adicionando...');
      await updateDoc(doctorRef, {
        doctorId: DOCTOR_ID,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Campo doctorId adicionado:', DOCTOR_ID);
    } else if (doctorData.doctorId !== DOCTOR_ID) {
      console.log('⚠️ Campo doctorId não corresponde. Atualizando...');
      await updateDoc(doctorRef, {
        doctorId: DOCTOR_ID,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Campo doctorId atualizado:', DOCTOR_ID);
    } else {
      console.log('✅ Campo doctorId já está correto:', DOCTOR_ID);
    }

    // Ensure fcmTokens object exists
    if (!doctorData.fcmTokens || typeof doctorData.fcmTokens !== 'object') {
      console.log('⚠️ Campo fcmTokens não encontrado ou inválido. Inicializando...');
      await updateDoc(doctorRef, {
        fcmTokens: {},
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Campo fcmTokens inicializado');
    } else {
      console.log('✅ Campo fcmTokens está correto');
    }

    console.log('🎉 Documento do médico atualizado com sucesso!');
    console.log('📱 Agora execute o script de teste de notificação novamente.');

  } catch (error) {
    console.error('❌ Erro ao atualizar documento do médico:', error);
  }
}

fixDoctorDocument();
