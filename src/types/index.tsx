export interface Doctor {
  id: string;
  doctorId?: string; // Firebase Auth UID
  name: string;
  email: string;
  specialty: string;
  crm: string;
  rating: number;
  experience: string;
  avatar: string;
  price: number;
  availableDays: number[];
  schedule: Record<string, string[]>;
  location: string;
  fcmToken?: string; // Token para notificações web (legado)
  fcmTokens?: Record<string, { device: string; lastUsed: string }>; // Tokens para notificações web (novo)
}

export interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  date: string;
  time: string;
  duration: number;
  location: string;
  status:
    | "scheduled"
    | "confirmed"
    | "completed"
    | "cancelled"
    | "patient_cancelled";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
  confirmedAt?: string;
  completedAt?: string;
}
