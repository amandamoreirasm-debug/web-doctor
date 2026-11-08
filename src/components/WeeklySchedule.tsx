import { useState, useEffect, useMemo } from "react";
// import { useAuth } from "../contexts/AuthContext";
import { subscribeToDoctorAppointmentsByDateRange } from "../services/appointmentService";
import type { Appointment } from "../types";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Loader2,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const TIME_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
];

export default function WeeklySchedule() {
  const { user } = useAuth();
  // const [doctorId, _] = useState<string | null>(user?.uid || null);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Calcular semana atual
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  const startDate = useMemo(
    () => format(weekDays[0], "yyyy-MM-dd"),
    [weekDays],
  );
  const endDate = useMemo(() => format(weekDays[4], "yyyy-MM-dd"), [weekDays]);

  // 1. Buscar doctorId
  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    // loadDoctor();
  }, [user?.email]);

  // 2. Subscribe em tempo real para o período da semana
  useEffect(() => {
    if (!user?.email) {
      console.log(
        "⚠️ doctorId não disponível, não será possível carregar a agenda",
      );
      setLoading(false);
      return;
    }

    console.log(
      `🔄 Inscrevendo em tempo real para semana: ${startDate} a ${endDate}`,
    );

    const unsubscribe = subscribeToDoctorAppointmentsByDateRange(
      user.uid,
      startDate,
      endDate,
      (newAppointments) => {
        console.log(
          `📋 Recebidos ${newAppointments.length} agendamentos para a semana`,
        );
        setAppointments(newAppointments);
        setLoading(false);
      },
    );

    return () => {
      console.log("🧹 Removendo inscrição da agenda semanal");
      setLoading(false);
      unsubscribe();
    };
  }, [user?.uid, startDate, endDate]);

  const isTimeInAppointment = (
    appointment?: Appointment,
    slotTime?: string,
  ) => {
    if (!appointment || !slotTime) return false;

    // Converter horários para minutos desde meia-noite
    const getMinutes = (time: string) => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const slotMinutes = getMinutes(slotTime);
    const aptStartMinutes = getMinutes(appointment.time);
    const aptEndMinutes = aptStartMinutes + (appointment.duration || 30);

    return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
  };

  // 3. Função para buscar agendamento específico
  // const getAppointment = (date: Date, time: string) => {
  //   console.log(
  //     `🔍 Buscando agendamento para ${format(date, "dd/MM/yyyy")} às ${time}`,
  //   );
  //   console.log("medico: ", doctorId);

  //   const dateStr = format(date, "yyyy-MM-dd");
  //   return appointments.find(
  //     (apt) =>
  //       apt.date === dateStr &&
  //       apt.time === time &&
  //       apt.status !== "cancelled" &&
  //       apt.doctorId === doctorId,
  //   );
  // };

  // 4. Navegação entre semanas
  const changeWeek = (days: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + days * 7);
    setCurrentWeekStart(newStart);
  };

  // 5. Voltar para semana atual
  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  // Função para verificar se um horário está dentro de um agendamento

  // No render da tabela, substitua a chamada getAppointment por:
  const getAppointmentForSlot = (date: Date, time: string) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return appointments.find(
      (apt) =>
        apt.date === dateStr &&
        isTimeInAppointment(apt, time) &&
        apt.status !== "patient_cancelled",
    );
  };

  const formatEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  console.log("📅 Renderizando WeeklySchedule com os seguintes dados:");
  console.log("User ID:", user?.uid);
  console.log(
    "Semana:",
    format(weekDays[0], "dd/MM/yyyy"),
    "-",
    format(weekDays[6], "dd/MM/yyyy"),
  );
  console.log("Agendamentos:", appointments);
  console.log("User logged:", user);

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Agenda Semanal</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeWeek(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Semana anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-medium">
            {format(weekDays[0], "dd/MM")} - {format(weekDays[4], "dd/MM/yyyy")}
          </span>
          <button
            onClick={() => changeWeek(1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
            title="Próxima semana"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={goToCurrentWeek}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Semana atual
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Horário
                </th>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th
                      key={day.toISOString()}
                      className={`px-4 py-3 text-left text-xs font-medium ${
                        isToday ? "text-blue-600" : "text-gray-500"
                      } uppercase`}
                    >
                      <div className="whitespace-nowrap">
                        {format(day, "EEEE", { locale: ptBR })
                          .charAt(0)
                          .toUpperCase() +
                          format(day, "EEEE", { locale: ptBR }).slice(1, 3)}
                      </div>
                      <div
                        className={`text-sm font-normal ${isToday ? "text-blue-600" : "text-gray-500"}`}
                      >
                        {format(day, "dd/MM")}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {TIME_SLOTS.map((slot) => (
                <tr key={slot} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r">
                    {slot}
                  </td>

                  {weekDays.map((day) => {
                    const apt = getAppointmentForSlot(day, slot);
                    const isToday = isSameDay(day, new Date());
                    const hasAppointment = !!apt;
                    const isCancelled = apt?.status === "cancelled";

                    // Verificar se este slot é o início do agendamento
                    const isStartOfAppointment = apt && apt.time === slot;

                    // Calcular altura do bloco (quantos slots de 30min)
                    // const slotsOccupied = apt
                    //   ? Math.ceil((apt.duration || 30) / 30)
                    //   : 1;

                    return (
                      <td
                        key={day.toISOString()}
                        className={`px-4 py-3 border-l ${
                          isToday ? "bg-blue-50/30" : ""
                        } ${
                          hasAppointment
                            ? isCancelled
                              ? "bg-red-50/50"
                              : "bg-green-50/50"
                            : ""
                        }`}
                        // rowSpan={
                        //   hasAppointment && isStartOfAppointment
                        //     ? slotsOccupied
                        //     : 1
                        // }
                      >
                        {hasAppointment && isStartOfAppointment ? (
                          <div className="text-sm">
                            <p
                              className={`font-medium ${
                                isCancelled
                                  ? "text-gray-500 line-through"
                                  : "text-gray-800"
                              }`}
                            >
                              {apt.patientName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {apt.time} -{" "}
                              {formatEndTime(apt.time, apt.duration || 30)}h
                            </p>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Phone size={10} /> {apt.patientPhone}
                            </div>

                            <span
                              className={`text-xs mt-1 inline-block flex items-center gap-1 ${
                                isCancelled ? "text-red-600" : "text-blue-600"
                              }`}
                            >
                              {isCancelled ? (
                                <>
                                  <XCircle size={12} /> Cancelado
                                </>
                              ) : (
                                `⏱️ ${apt.duration} min`
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className={`text-xs text-gray-400 `}>
                            {isTimeInAppointment(apt, slot)
                              ? `- Ocupado -`
                              : `- Livre -`}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
