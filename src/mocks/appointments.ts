import type { Appointment } from "../types";

const doctor = {
  id: "doc1",
  name: "Dra. Ana Beatriz Costa",
  specialty: "Cardiologia",
  location: "Consultório 304 - Torre Norte",
};

const patientNames = [
  "João Silva",
  "Maria Oliveira",
  "Carlos Santos",
  "Fernanda Lima",
  "Roberto Alves",
  "Juliana Mendes",
  "Ricardo Souza",
  "Patrícia Gomes",
  "Eduardo Martins",
  "Camila Rocha",
  "Lucas Ferreira",
  "Beatriz Nunes",
  "Mariana Costa",
  "Felipe Andrade",
  "Amanda Ribeiro",
  "Thiago Martins",
  "Larissa Souza",
  "Rafael Gomes",
  "Vanessa Almeida",
  "Gabriel Rocha",
];

const possibleDurations = [30, 60, 90];

const possibleTimes = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:30",
  "11:00",
  "13:00",
  "13:30",
  "14:00",
  "15:00",
  "15:30",
  "16:30",
  "17:00",
  "17:30",
];

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function generatePhone(index: number) {
  return `(11) 9${String(1000 + index).padStart(4, "0")}-${String(
    1000 + index,
  ).padStart(4, "0")}`;
}

function isPastAppointment(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  const appointmentDate = new Date(date);
  appointmentDate.setHours(hours, minutes, 0, 0);

  return appointmentDate.getTime() < Date.now();
}

function getNextBusinessDays(totalDays: number) {
  const businessDays: Date[] = [];
  const current = new Date();

  current.setHours(0, 0, 0, 0);

  while (businessDays.length < totalDays) {
    const day = current.getDay();

    // 0 = domingo | 6 = sábado
    if (day !== 6) {
      businessDays.push(new Date(current));
    }

    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}

function generateAppointments(): Appointment[] {
  const appointments: Appointment[] = [];
  const businessDays = getNextBusinessDays(10);

  let appointmentCounter = 1;

  businessDays.forEach((date, dateIndex) => {
    const appointmentsPerDay = Math.floor(Math.random() * 5) + 3;

    const usedTimes = new Set<string>();

    for (let i = 0; i < appointmentsPerDay; i++) {
      let selectedTime = randomItem(possibleTimes);

      while (usedTimes.has(selectedTime)) {
        selectedTime = randomItem(possibleTimes);
      }

      usedTimes.add(selectedTime);

      const patientName = randomItem(patientNames);
      const duration = randomItem(possibleDurations);

      const isPast = isPastAppointment(date, selectedTime);

      let status: Appointment["status"];

      if (isPast) {
        status = Math.random() > 0.2 ? "completed" : "confirmed";
      } else {
        status = randomItem(["scheduled", "confirmed"]);
      }

      const createdAt = new Date(date);
      createdAt.setDate(createdAt.getDate() - (dateIndex + 1));
      createdAt.setHours(9, 0, 0, 0);

      const updatedAt = new Date(createdAt);

      const appointment: Appointment = {
        id: `apt-${appointmentCounter}`,
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty,
        patientId: `patient-${appointmentCounter}`,
        patientName,
        patientPhone: generatePhone(appointmentCounter),
        date: formatDate(date),
        time: selectedTime,
        duration,
        location: doctor.location,
        status,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };

      if (status === "completed") {
        const completedAt = new Date(date);

        const [hours, minutes] = selectedTime.split(":").map(Number);

        completedAt.setHours(hours, minutes + duration, 0, 0);

        appointment.completedAt = completedAt.toISOString();
      }

      if (status === "confirmed") {
        appointment.confirmedAt = updatedAt.toISOString();
      }

      if (Math.random() > 0.7) {
        appointment.notes = randomItem([
          "Paciente em retorno",
          "Avaliação cardíaca",
          "Exames laboratoriais pendentes",
          "Consulta de rotina",
          "Paciente relata dores no peito",
          "Acompanhamento pós-cirúrgico",
        ]);
      }

      appointments.push(appointment);

      appointmentCounter++;
    }
  });

  return appointments.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}:00`);
    const dateB = new Date(`${b.date}T${b.time}:00`);

    return dateA.getTime() - dateB.getTime();
  });
}

export const mockAppointments: Appointment[] = generateAppointments();
