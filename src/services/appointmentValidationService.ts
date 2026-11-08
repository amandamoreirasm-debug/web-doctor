import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config";

/**
 * Valida se há conflito de horário para um agendamento
 * @param params Parâmetros de validação
 * @returns Resultado da validação
 */
export async function validateAppointmentConflictCheck(params: {
  doctorId: string;
  date: string;
  time: string;
  duration: number;
  excludeAppointmentId?: string;
}) {
  try {
    const validateFunction = httpsCallable(
      functions,
      "validateAppointmentConflictCheck"
    );
    const result = await validateFunction(params);
    return result.data as { valid: boolean; error?: string };
  } catch (error) {
    console.error("Erro ao validar conflito de agendamento:", error);
    throw error;
  }
}

/**
 * Valida agendamento antes de criar
 * @param appointmentData Dados do agendamento
 * @returns true se válido, false se houver conflito
 */
export async function validateBeforeCreateAppointment(appointmentData: {
  doctorId: string;
  date: string;
  time: string;
  duration: number;
}) {
  const validation = await validateAppointmentConflictCheck(appointmentData);
  
  if (!validation.valid) {
    throw new Error(validation.error || "Conflito de horário detectado");
  }
  
  return true;
}

/**
 * Valida agendamento antes de atualizar
 * @param appointmentData Dados do agendamento
 * @param appointmentId ID do agendamento sendo atualizado
 * @returns true se válido, false se houver conflito
 */
export async function validateBeforeUpdateAppointment(
  appointmentData: {
    doctorId: string;
    date: string;
    time: string;
    duration: number;
  },
  appointmentId: string
) {
  const validation = await validateAppointmentConflictCheck({
    ...appointmentData,
    excludeAppointmentId: appointmentId,
  });
  
  if (!validation.valid) {
    throw new Error(validation.error || "Conflito de horário detectado");
  }
  
  return true;
}
