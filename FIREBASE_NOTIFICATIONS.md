# Sistema de Notificações FCM com Firebase Cloud Functions

Este projeto está configurado para receber notificações via Firebase Cloud Messaging (FCM) e acionar Cloud Functions automaticamente, tanto para médicos quanto para pacientes.

## Fluxo de Notificações

### Fluxo 1: Sistema → Médico (Web)

```
Criar documento em 'notifications'
    ↓
Cloud Function: sendNotificationToDoctor
    ↓
Buscar médico em 'doctors' (doctorId)
    ↓
Obter fcmToken do médico
    ↓
Enviar notificação FCM
    ↓
Médico recebe notificação no browser
```

### Fluxo 1b: Agendamento Criado → Médico (Web)

```
Criar agendamento em 'appointments'
    ↓
Cloud Function: notifyDoctorOnAppointmentCreated
    ↓
Buscar médico em 'doctors' (doctorId)
    ↓
Determinar mensagem baseada na data:
    - Se for hoje: "Nova consulta hoje às [hora] - Paciente: [nome]"
    - Se for outra data: "Nova consulta em [data] às [hora] - Paciente: [nome]"
    ↓
Obter fcmToken do médico
    ↓
Enviar notificação FCM
    ↓
Médico recebe notificação no browser
    ↓
Registrar em 'doctor_notifications'
```

### Fluxo 2: Médico → Paciente (Mobile)

```
Médico altera agendamento (update em 'appointments')
    ↓
Cloud Function: notifyPatientOnAppointmentUpdate
    ↓
Buscar paciente em 'users' (patientId == id)
    ↓
Obter fcmToken do paciente
    ↓
Enviar notificação FCM
    ↓
Paciente recebe notificação no app mobile
    ↓
Registrar em 'patient_notifications'
```

## Configuração

### 1. Variáveis de Ambiente

Certifique-se de que o arquivo `.env` contém as seguintes variáveis:

```env
VITE_FIREBASE_API_KEY=AIzaSyBHEbg9UrRNDFv3qqY3_Ev9woDJserLvu8
VITE_FIREBASE_AUTH_DOMAIN=doctor-f3a93.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=doctor-f3a93
VITE_FIREBASE_STORAGE_BUCKET=doctor-f3a93.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=282554407746
VITE_FIREBASE_APP_ID=1:282554407746:web:83ed0865ce9917b3a046db
VITE_FIREBASE_MEASUREMENT_ID=G-63WLGW50H1
VITE_FIREBASE_VAPID_KEY=BHcpCPotXAiR0n905b5VbA9zYG_LDR42-Wq1QWF4lV_xIfy_gtwFie4hEtIDmjFDD6ziZ6UWP5DZZ4xjFwJtBOA
```

### 2. Cloud Functions

As Cloud Functions estão configuradas no diretório `functions/`:

- **sendNotificationToDoctor**: Trigger automático quando um documento é criado na coleção `notifications`
- **sendNotification**: Função callable para enviar notificação para um médico específico
- **sendBulkNotifications**: Função callable para enviar notificações em massa
- **notifyPatientOnAppointmentUpdate**: Trigger automático quando um agendamento é atualizado (envia notificação para o paciente)
- **notifyDoctorOnAppointmentCreated**: Trigger automático quando um agendamento é criado (envia notificação para o médico)

## Como Usar

### Método 1: Trigger Automático (Recomendado)

Crie um documento na coleção `notifications` do Firestore:

```javascript
import { createNotificationDocument } from "./services/cloudFunctionService";

await createNotificationDocument({
  doctorId: "ID_DO_MEDICO",
  title: "Nova Consulta",
  body: "Você tem uma nova consulta agendada",
  data: {
    type: "appointment",
    click_action: "/dashboard",
  },
});
```

A Cloud Function `sendNotificationToDoctor` será acionada automaticamente e enviará a notificação para o médico.

### Método 2: Função Callable

Chame diretamente a função callable:

```javascript
import { sendNotificationToDoctor } from "./services/cloudFunctionService";

await sendNotificationToDoctor({
  doctorId: "ID_DO_MEDICO",
  title: "Nova Consulta",
  body: "Você tem uma nova consulta agendada",
  data: {
    type: "appointment",
    click_action: "/dashboard",
  },
});
```

### Método 3: Teste via Dashboard

Use o componente `NotificationTest` no Dashboard para testar notificações:

1. Faça login como médico
2. Vá para o Dashboard
3. Use o componente "Teste de Notificações FCM"
4. Clique em "Enviar Notificação de Teste"

## Notificações para Pacientes (Mobile)

### Fluxo: Médico altera agendamento → Notificação para paciente

Quando um médico altera um agendamento (status, data, hora, local), a Cloud Function `notifyPatientOnAppointmentUpdate` é acionada automaticamente:

1. **Trigger**: Update na coleção `appointments`
2. **Busca paciente**: Procura usuário na coleção `users` onde `id == patientId`
3. **Envia notificação**: Usa o `fcmToken` do usuário para enviar notificação
4. **Registra histórico**: Cria documento em `patient_notifications`

### Estrutura do Firestore

#### Coleção `users` (Pacientes)

```javascript
{
  id: "patientUserId",
  name: "Nome do Paciente",
  email: "paciente@email.com",
  fcmToken: "device_fcm_token",
  fcmTokenUpdatedAt: "2024-08-17T..."
}
```

#### Coleção `patient_notifications` (Histórico)

```javascript
{
  patientId: "patientUserId",
  appointmentId: "appointmentId",
  title: "Atualização no Agendamento",
  body: "Seu agendamento foi confirmado!",
  type: "appointment_update",
  sentAt: Timestamp,
  status: "sent" | "failed",
  error: "error_message" // se falhar
}
```

### Tipos de Alterações Monitoradas

- **Status**: Confirmação, cancelamento, conclusão
- **Data/Hora**: Remarcamento
- **Local**: Mudança de consultório

### Testar Notificação para Paciente

```bash
npm run test:patient-notification
```

Este script:

1. Cria/Atualiza usuário paciente com FCM token
2. Cria agendamento de teste
3. Atualiza o agendamento (trigger)
4. Verifica se notificação foi enviada

## Deploy das Cloud Functions

Para fazer deploy das Cloud Functions:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Estrutura do Firestore

### Coleção `doctors`

Cada documento médico deve ter:

- `fcmToken`: Token FCM do dispositivo
- `fcmTokenUpdatedAt`: Timestamp da última atualização do token

### Coleção `notifications`

Documentos de notificação:

- `doctorId`: ID do médico destinatário
- `title`: Título da notificação
- `body`: Corpo da notificação
- `data`: Dados adicionais (opcional)
- `status`: Status (pending/sent/failed)
- `createdAt`: Timestamp de criação
- `sentAt`: Timestamp de envio (se sucesso)
- `failedAt`: Timestamp de falha (se erro)
- `error`: Mensagem de erro (se falha)

### Coleção `users` (Pacientes)

Documentos de usuários pacientes:

- `id`: ID do usuário (igual ao patientId)
- `name`: Nome do paciente
- `email`: Email do paciente
- `fcmToken`: Token FCM do dispositivo mobile
- `fcmTokenUpdatedAt`: Timestamp da última atualização do token

### Coleção `patient_notifications`

Histórico de notificações enviadas para pacientes:

- `patientId`: ID do paciente
- `appointmentId`: ID do agendamento
- `title`: Título da notificação
- `body`: Corpo da notificação
- `type`: Tipo de notificação (appointment_update)
- `sentAt`: Timestamp de envio
- `status`: Status (sent/failed)
- `error`: Mensagem de erro (se falhar)

### Coleção `doctor_notifications`

Histórico de notificações enviadas para médicos:

- `doctorId`: ID do médico
- `appointmentId`: ID do agendamento
- `title`: Título da notificação
- `body`: Corpo da notificação
- `type`: Tipo de notificação (new_appointment)
- `sentAt`: Timestamp de envio
- `status`: Status (sent/failed)
- `error`: Mensagem de erro (se falhar)

## Service Worker

O service worker `firebase-messaging-sw.js` é copiado automaticamente para o diretório `public/` durante o build pelo Vite.

## Debug

### Ver Logs das Cloud Functions

```bash
firebase functions:log
```

### Verificar Token FCM

Abra o console do navegador e verifique se o token foi registrado:

```javascript
console.log("Token FCM:", localStorage.getItem("fcmToken"));
```

### Verificar Permissões

```javascript
console.log("Permissão de notificação:", Notification.permission);
```

## Notas Importantes

1. **HTTPS**: Notificações web só funcionam em HTTPS ou localhost
2. **Permissão**: O usuário deve conceder permissão para receber notificações
3. **Background**: Notificações em background são manipuladas pelo service worker
4. **Foreground**: Notificações em foreground são exibidas como toasts customizados
5. **VAPID Key**: A VAPID Key é necessária para web push notifications

## Troubleshooting

### Notificações não aparecem

1. Verifique se o usuário concedeu permissão
2. Verifique se o token FCM foi salvo no Firestore
3. Verifique os logs das Cloud Functions
4. Verifique se o service worker está registrado
5. Verifique se está usando HTTPS ou localhost

### Cloud Function não é acionada

1. Verifique se as Cloud Functions foram deployadas
2. Verifique se o trigger está configurado corretamente
3. Verifique os logs do Firebase Console

### Token FCM inválido

1. Tokens podem expirar - o sistema atualiza automaticamente
2. Verifique se o VAPID Key está correto
3. Verifique se o service worker está ativo

## Scripts de Teste Disponíveis

```bash
# Notificações para médicos
npm run create:notification          # Criar notificação para médico
npm run update:fcm-token            # Atualizar FCM token do médico
npm run create:appointment          # Criar agendamento de teste

# Notificações para pacientes
npm run test:patient-notification   # Testar notificação para paciente
```

## Resumo das Cloud Functions Deployadas

| Função                           | Trigger                 | Destinatário      | Região             |
| -------------------------------- | ----------------------- | ----------------- | ------------------ |
| sendNotificationToDoctor         | onCreate(notifications) | Médico            | southamerica-east1 |
| sendNotification                 | callable                | Médico            | us-central1        |
| sendBulkNotifications            | callable                | Múltiplos médicos | us-central1        |
| notifyPatientOnAppointmentUpdate | onUpdate(appointments)  | Paciente          | southamerica-east1 |
| notifyDoctorOnAppointmentCreated | onCreate(appointments)  | Médico            | southamerica-east1 |
