/**
 * Utilitários para validação de conflitos de horário em agendamentos
 */

/**
 * Converte hora no formato "HH:MM" para minutos do dia
 * Exemplo: "17:30" -> 1050 minutos
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converte minutos do dia para formato "HH:MM"
 * Exemplo: 1050 minutos -> "17:30"
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Verifica se há conflito entre dois intervalos de tempo
 * @param start1 Início do primeiro intervalo em minutos
 * @param end1 Fim do primeiro intervalo em minutos
 * @param start2 Início do segundo intervalo em minutos
 * @param end2 Fim do segundo intervalo em minutos
 * @returns true se houver conflito, false caso contrário
 */
export function hasTimeConflict(
  start1: number,
  end1: number,
  start2: number,
  end2: number
): boolean {
  // Se um intervalo termina antes do outro começar, não há conflito
  if (end1 <= start2 || end2 <= start1) {
    return false;
  }
  // Caso contrário, há sobreposição
  return true;
}

/**
 * Calcula o intervalo de tempo de um agendamento
 * @param time Hora no formato "HH:MM"
 * @param duration Duração em minutos
 * @returns Objeto com início e fim em minutos do dia
 */
export function calculateAppointmentInterval(
  time: string,
  duration: number
): { start: number; end: number } {
  const start = timeToMinutes(time);
  const end = start + duration;
  return { start, end };
}

/**
 * Valida se um novo agendamento conflita com agendamentos existentes
 * @param existingAppointments Lista de agendamentos existentes
 * @param newAppointment Novo agendamento a ser validado
 * @param excludeAppointmentId ID do agendamento a ser excluído da validação (para atualizações)
 * @returns Objeto com validação e mensagem de erro se houver conflito
 */
export function validateAppointmentConflict(
  existingAppointments: any[],
  newAppointment: {
    doctorId: string;
    date: string;
    time: string;
    duration: number;
  },
  excludeAppointmentId?: string
): { valid: boolean; error?: string; conflictingAppointment?: any } {
  const { doctorId, date, time, duration } = newAppointment;
  
  // Filtrar agendamentos do mesmo médico e mesmo dia
  const sameDayAppointments = existingAppointments.filter(
    (apt) => 
      apt.doctorId === doctorId && 
      apt.date === date &&
      apt.id !== excludeAppointmentId
  );

  if (sameDayAppointments.length === 0) {
    return { valid: true };
  }

  // Calcular intervalo do novo agendamento
  const newInterval = calculateAppointmentInterval(time, duration);

  // Verificar conflito com cada agendamento existente
  for (const existing of sameDayAppointments) {
    const existingInterval = calculateAppointmentInterval(
      existing.time,
      existing.duration
    );

    if (
      hasTimeConflict(
        newInterval.start,
        newInterval.end,
        existingInterval.start,
        existingInterval.end
      )
    ) {
      return {
        valid: false,
        error: `Conflito de horário: Já existe agendamento das ${existing.time} às ${minutesToTime(existingInterval.end)}`,
        conflictingAppointment: existing,
      };
    }
  }

  return { valid: true };
}

/**
 * Formata mensagem de erro de conflito de forma amigável
 */
export function formatConflictMessage(conflictingTime: string, conflictingDuration: number): string {
  const conflictingEnd = minutesToTime(timeToMinutes(conflictingTime) + conflictingDuration);
  return `Horário indisponível: Já existe agendamento das ${conflictingTime} às ${conflictingEnd}`;
}