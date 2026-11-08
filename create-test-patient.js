import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Configuração do Firebase usando variáveis de ambiente
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Dados do paciente
const PATIENT_DATA = {
  email: process.env.TEST_PATIENT_EMAIL || "paciente.teste@email.com",
  password: process.env.TEST_PATIENT_PASSWORD || "teste123456",
  name: process.env.TEST_PATIENT_NAME || "Paciente Teste Silva",
  phone: process.env.TEST_PATIENT_PHONE || "(11) 99999-7777",
};

async function createTestPatient() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('👤 Criando usuário no Firebase Auth...');
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      PATIENT_DATA.email, 
      PATIENT_DATA.password
    );
    
    const uid = userCredential.user.uid;
    console.log(`✅ Usuário criado com UID: ${uid}`);

    console.log('📝 Salvando dados no Firestore...');
    await setDoc(doc(db, 'users', uid), {
      name: PATIENT_DATA.name,
      email: PATIENT_DATA.email,
      phone: PATIENT_DATA.phone,
      role: 'patient',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Paciente criado com sucesso!');
    console.log(`
┌─────────────────────────────────────────┐
│  Dados do Paciente                      │
├─────────────────────────────────────────┤
│  UID:    ${uid}                          │
│  Nome:   ${PATIENT_DATA.name}           │
│  Email:  ${PATIENT_DATA.email}          │
│  Senha:  ${PATIENT_DATA.password}       │
│  Telefone: ${PATIENT_DATA.phone}        │
└─────────────────────────────────────────┘
    `);
    
    return { uid, ...PATIENT_DATA };
  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code === 'auth/email-already-in-use') {
      console.log('⚠️ Email já existe! Use outro email ou faça login.');
    }
  }
}

createTestPatient();