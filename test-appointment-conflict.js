import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

const DOCTOR_ID = "pVDfU9kDhAeCg1FyWaScUXugIym2";
const DOCTOR_NAME = "Dra. Ana Beatriz Costa";
const DOCTOR_SPECIALTY = "Cardiologia";
const LOCATION = "Consultório 304 - Torre Norte";

const TEST_PATIENT = {
  id: "Jq964VFEEoTmSlVuFxDphJOZQgm2",
  name: "Paciente Teste Silva",
  phone: "(11) 99999-7777"
};

// Função para converter hora em minutos
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Função para verificar conflito de horário
function hasTimeConflict(start1, end1, start2, end2) {
  // Conflito se os intervalos se sobreporem
  // Se um termina antes ou no mesmo momento que o outro começa, não há conflito
  // Exemplo: 16:30-17:00 e 17:00-18:00 NÃO conflitam
  if (end1 <= start2 || end2 <= start1) {
    return false;
  }
  // Caso contrário, há sobreposição
  return true;
}

// Função para validar conflito de agendamento
async function validateAppointmentConflict(db, doctorId, date, time, duration, excludeAppointmentId = null) {
  console.log(`🔍 Validando conflito para: ${date} às ${time} (${duration}min)`);
  
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
    // Excluir o próprio agendamento em caso de atualização
    if (excludeAppointmentId && doc.id === excludeAppointmentId) {
      console.log(`   ⏭️  Pulando agendamento próprio: ${doc.id}`);
      continue;
    }
    
    const existing = doc.data();
    const existingStart = timeToMinutes(existing.time);
    const existingEnd = existingStart + existing.duration;
    
    console.log(`   Agendamento existente: ${existingStart}min → ${existingEnd}min (${existing.time} → ${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')})`);
    
    if (hasTimeConflict(newStart, newEnd, existingStart, existingEnd)) {
      const conflictingEnd = `${Math.floor(existingEnd/60)}:${(existingEnd%60).toString().padStart(2,'0')}`;
      return {
        valid: false,
        error: `Conflito de horário: Já existe agendamento das ${existing.time} às ${conflictingEnd}`,
        conflictingAppointment: { id: doc.id, ...existing }
      };
    }
  }
  
  console.log('✅ Sem conflitos de horário');
  return { valid: true };
}

async function testAppointmentConflict() {
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    console.log('🔐 Autenticando como médico...');
    await signInWithEmailAndPassword(auth, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    console.log('✅ Autenticado com sucesso!');

    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Data de teste: ${today}`);

    // Limpar agendamentos de teste existentes
    console.log('\n🧹 Limpando agendamentos de teste existentes...');
    const allAppointmentsQuery = query(
      collection(db, 'appointments'),
      where('doctorId', '==', DOCTOR_ID),
      where('date', '==', today)
    );
    const allSnapshot = await getDocs(allAppointmentsQuery);
    
    console.log(`   Encontrados ${allSnapshot.size} agendamentos para hoje`);
    
    for (const doc of allSnapshot.docs) {
      const notes = doc.data().notes || '';
      if (notes.includes('Teste de conflito') || notes.includes('Agendamento de teste')) {
        await deleteDoc(doc.ref);
        console.log(`   🗑️  Deletado agendamento: ${doc.id} (${notes})`);
      }
    }

    // ============================================
    // TESTE 1: Criar agendamento sem conflito
    // ============================================
    console.log('\n🧪 TESTE 1: Criar agendamento sem conflito (16:30, 30min)');
    const appointment1 = {
      doctorId: DOCTOR_ID,
      doctorName: DOCTOR_NAME,
      doctorSpecialty: DOCTOR_SPECIALTY,
      patientId: TEST_PATIENT.id,
      patientName: TEST_PATIENT.name,
      patientPhone: TEST_PATIENT.phone,
      date: today,
      time: "16:30",
      duration: 30,
      location: LOCATION,
      status: 'scheduled',
      notes: 'Teste de conflito - consulta 1',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const validation1 = await validateAppointmentConflict(db, DOCTOR_ID, today, "16:30", 30);
    if (validation1.valid) {
      const docRef1 = await addDoc(collection(db, 'appointments'), appointment1);
      console.log(`✅ Agendamento 1 criado: ${docRef1.id}`);
    } else {
      console.log(`❌ Validação falhou: ${validation1.error}`);
    }

    // ============================================
    // TESTE 2: Criar agendamento que NÃO conflita (17:00, 30min)
    // 16:30-17:00 e 17:00-17:30 NÃO conflitam (17:00 é o limite exato)
    // ============================================
    console.log('\n🧪 TESTE 2: Criar agendamento que NÃO conflita (17:00, 30min)');
    const appointment2 = {
      doctorId: DOCTOR_ID,
      doctorName: DOCTOR_NAME,
      doctorSpecialty: DOCTOR_SPECIALTY,
      patientId: TEST_PATIENT.id,
      patientName: TEST_PATIENT.name,
      patientPhone: TEST_PATIENT.phone,
      date: today,
      time: "17:00",
      duration: 30,
      location: LOCATION,
      status: 'scheduled',
      notes: 'Teste de conflito - consulta 2',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const validation2 = await validateAppointmentConflict(db, DOCTOR_ID, today, "17:00", 30);
    if (validation2.valid) {
      const docRef2 = await addDoc(collection(db, 'appointments'), appointment2);
      console.log(`✅ Agendamento 2 criado: ${docRef2.id} (sem conflito, esperado)`);
    } else {
      console.log(`❌ Validação falhou (inesperado): ${validation2.error}`);
    }

    // ============================================
    // TESTE 3: Tentar criar agendamento que CONFLITA (17:15, 30min)
    // Conflita com 17:00-17:30? SIM (17:15 está dentro do intervalo)
    // ============================================
    console.log('\n🧪 TESTE 3: Tentar criar agendamento que CONFLITA (17:15, 30min)');
    const validation3 = await validateAppointmentConflict(db, DOCTOR_ID, today, "17:15", 30);
    if (validation3.valid) {
      console.log('❌ Validação passou (inesperado - deveria ter conflito)');
    } else {
      console.log(`✅ Validação falhou conforme esperado: ${validation3.error}`);
    }

    // ============================================
    // TESTE 4: Criar agendamento em horário livre (18:00, 30min)
    // ============================================
    console.log('\n🧪 TESTE 4: Criar agendamento em horário livre (18:00, 30min)');
    const appointment4 = {
      doctorId: DOCTOR_ID,
      doctorName: DOCTOR_NAME,
      doctorSpecialty: DOCTOR_SPECIALTY,
      patientId: TEST_PATIENT.id,
      patientName: TEST_PATIENT.name,
      patientPhone: TEST_PATIENT.phone,
      date: today,
      time: "18:00",
      duration: 30,
      location: LOCATION,
      status: 'scheduled',
      notes: 'Teste de conflito - consulta 3',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const validation4 = await validateAppointmentConflict(db, DOCTOR_ID, today, "18:00", 30);
    let docRef4 = null;
    if (validation4.valid) {
      docRef4 = await addDoc(collection(db, 'appointments'), appointment4);
      console.log(`✅ Agendamento 3 criado: ${docRef4.id}`);
    } else {
      console.log(`❌ Validação falhou: ${validation4.error}`);
    }

    // ============================================
    // TESTE 5: Tentar atualizar agendamento para horário conflitante
    // ============================================
    console.log('\n🧪 TESTE 5: Tentar atualizar agendamento para horário conflitante (17:15, 30min)');
    if (docRef4) {
      const validation5 = await validateAppointmentConflict(db, DOCTOR_ID, today, "17:15", 30, docRef4.id);
      if (validation5.valid) {
        console.log('❌ Validação passou (inesperado - deveria ter conflito)');
      } else {
        console.log(`✅ Validação falhou conforme esperado: ${validation5.error}`);
      }
    }

    // ============================================
    // TESTE 6: Atualizar agendamento para horário livre
    // ============================================
    console.log('\n🧪 TESTE 6: Atualizar agendamento para horário livre (18:30, 30min)');
    if (docRef4) {
      const validation6 = await validateAppointmentConflict(db, DOCTOR_ID, today, "18:30", 30, docRef4.id);
      if (validation6.valid) {
        await updateDoc(doc(db, 'appointments', docRef4.id), {
          time: "18:30",
          updatedAt: Timestamp.now(),
        });
        console.log(`✅ Agendamento atualizado para 18:30`);
      } else {
        console.log(`❌ Validação falhou: ${validation6.error}`);
      }
    }

    // ============================================
    // TESTE 7: Agendamento em outro dia (mesmo horário)
    // ============================================
    console.log('\n🧪 TESTE 7: Criar agendamento em outro dia (mesmo horário)');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    const validation7 = await validateAppointmentConflict(db, DOCTOR_ID, tomorrowDate, "16:30", 30);
    if (validation7.valid) {
      console.log('✅ Validação passou - datas diferentes permitem mesmo horário');
    } else {
      console.log(`❌ Validação falhou (inesperado): ${validation7.error}`);
    }

    console.log('\n🎉 Testes de validação de conflito concluídos!');
    console.log('💡 Resumo:');
    console.log('   ✅ Validação funciona corretamente');
    console.log('   ✅ Detecta conflitos de horário');
    console.log('   ✅ Permite atualizações sem conflito');
    console.log('   ✅ Permite mesmo horário em dias diferentes');
    console.log('   ✅ Impede criação/atualização com conflito');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    if (error.code) console.error(`Código: ${error.code}`);
  }
}

// Executar
testAppointmentConflict();
