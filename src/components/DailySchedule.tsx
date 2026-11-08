import { useState, useEffect } from "react";
import {
  updateAppointmentStatus,
  subscribeToDoctorAppointments,
} from "../services/appointmentService";
import type { Appointment } from "../types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Phone,
  MapPin,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
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

// Funções auxiliares
const getMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const isTimeInAppointment = (appointment: Appointment, slotTime: string) => {
  if (!appointment) return false;
  const slotMinutes = getMinutes(slotTime);
  const aptStartMinutes = getMinutes(appointment.time);
  const aptEndMinutes = aptStartMinutes + (appointment.duration || 30);
  return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
};

const formatEndTime = (startTime: string, durationMinutes: number) => {
  const totalMinutes = getMinutes(startTime) + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, "0")}:${endMinutes.toString().padStart(2, "0")}`;
};

export default function DailySchedule() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;

    setLoading(true);
    const unsubscribe = subscribeToDoctorAppointments(
      user.uid,
      dateStr,
      (newAppointments) => {
        setAppointments(newAppointments);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.email, dateStr]);

  // Buscar agendamento para um slot específico (considerando duration)
  const getAppointmentForSlot = (time: string) => {
    return appointments.find(
      (apt) =>
        isTimeInAppointment(apt, time) && apt.status !== "patient_cancelled",
    );
  };

  // Verificar se é o primeiro slot do agendamento
  const isFirstSlotOfAppointment = (
    apt: Appointment | undefined,
    slotTime: string,
  ) => {
    return apt && apt.time === slotTime;
  };

  const handleUpdateStatus = async (
    apt: Appointment,
    newStatus: Appointment["status"],
  ) => {
    try {
      await updateAppointmentStatus(apt.id, newStatus);
      toast.success(
        `Status atualizado para ${newStatus === "confirmed" ? "Confirmado" : "Realizado"}`,
      );
      setSelectedAppointment(null);
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    if (!cancellationReason.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }

    try {
      await updateAppointmentStatus(
        selectedAppointment.id,
        "cancelled",
        cancellationReason,
      );
      toast.success("Consulta cancelada");
      setSelectedAppointment(null);
      setCancellationReason("");
    } catch (error) {
      toast.error("Erro ao cancelar consulta");
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const getStatusBadge = (status: Appointment["status"]) => {
    const config = {
      scheduled: {
        bg: "bg-yellow-100",
        text: "Agendado",
        color: "text-yellow-700",
        icon: Clock,
      },
      confirmed: {
        bg: "bg-blue-100",
        text: "Confirmado",
        color: "text-blue-700",
        icon: CheckCircle,
      },
      completed: {
        bg: "bg-green-100",
        text: "Realizado",
        color: "text-green-700",
        icon: CheckCircle,
      },
      cancelled: {
        bg: "bg-red-100",
        text: "Cancelado",
        color: "text-red-700",
        icon: XCircle,
      },
      patient_cancelled: {
        bg: "bg-orange-100",
        text: "Cancelado pelo Paciente",
        color: "text-orange-700",
        icon: XCircle,
      },
    };
    const statusConfig = config[status || "completed"];
    if (!statusConfig) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
          <Clock size={12} /> {status || "Desconhecido"}
        </span>
      );
    }
    const { bg, text, color, icon: Icon } = statusConfig;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${color}`}
      >
        <Icon size={12} /> {text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Agenda Diária</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => changeDate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-medium">
            {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </span>
          <button
            onClick={() => changeDate(1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Horário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Contato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {TIME_SLOTS.map((slot) => {
                const apt = getAppointmentForSlot(slot);
                const isFree = !apt;
                const isCancelled = apt?.status === "cancelled";
                const isFirstSlot = isFirstSlotOfAppointment(apt, slot);
                const duration = apt?.duration || 30;
                const isLongAppointment = duration > 30;

                return (
                  <tr
                    key={slot}
                    className={
                      isFree
                        ? "bg-green-50"
                        : isCancelled
                          ? "bg-red-50/50"
                          : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {slot}
                      {isFirstSlot && isLongAppointment && (
                        <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {duration}min
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {apt ? (
                        <div>
                          <span
                            className={`font-medium ${
                              isCancelled
                                ? "text-gray-500 line-through"
                                : "text-gray-800"
                            }`}
                          >
                            {apt.patientName}
                          </span>
                          {isFirstSlot && isLongAppointment && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {apt.time} - {formatEndTime(apt.time, duration)}h
                            </p>
                          )}
                        </div>
                      ) : (
                        "— Livre —"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {apt ? apt.patientPhone : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {apt ? (
                        getStatusBadge(apt.status)
                      ) : (
                        <span className="text-green-600 text-sm">
                          Disponível
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {apt &&
                        apt.status !== "cancelled" &&
                        apt.status !== "completed" &&
                        isFirstSlot && (
                          <div className="flex gap-2">
                            {apt.status === "scheduled" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(apt, "confirmed")
                                }
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Confirmar
                              </button>
                            )}
                            {apt.status === "confirmed" && (
                              <button
                                onClick={() =>
                                  handleUpdateStatus(apt, "completed")
                                }
                                className="text-green-600 hover:text-green-800"
                              >
                                Finalizar
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedAppointment(apt)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => setSelectedAppointment(apt)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              Detalhes
                            </button>
                          </div>
                        )}
                      {apt && isCancelled && isFirstSlot && (
                        <button
                          onClick={() => setSelectedAppointment(apt)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          Ver detalhes
                        </button>
                      )}
                      {apt && isFirstSlot === false && !isCancelled && (
                        <span className="text-xs text-gray-400 italic">
                          Parte da consulta
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de detalhes/cancelamento */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Detalhes da Consulta
                </h3>
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Duração destaque */}
                {(selectedAppointment.duration || 30) > 30 && (
                  <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-2">
                    <Clock size={18} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        Duração da consulta
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedAppointment.duration} minutos
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <User size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Paciente
                    </p>
                    <p className="text-gray-900">
                      {selectedAppointment.patientName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Phone size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Telefone
                    </p>
                    <p className="text-gray-900">
                      {selectedAppointment.patientPhone}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Clock size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Data e Horário
                    </p>
                    <p className="text-gray-900">
                      {format(new Date(selectedAppointment.date), "dd/MM/yyyy")}{" "}
                      às {selectedAppointment.time}h
                      {(selectedAppointment.duration || 30) > 30 && (
                        <span className="text-sm text-gray-500 ml-1">
                          (até{" "}
                          {formatEndTime(
                            selectedAppointment.time,
                            selectedAppointment.duration || 30,
                          )}
                          h)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Local</p>
                    <p className="text-gray-900">
                      {selectedAppointment.location}
                    </p>
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div className="flex items-start gap-2">
                    <FileText size={18} className="text-gray-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Observações
                      </p>
                      <p className="text-gray-900">
                        {selectedAppointment.notes}
                      </p>
                    </div>
                  </div>
                )}

                {selectedAppointment.status === "cancelled" &&
                  selectedAppointment.cancellationReason && (
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-sm font-medium text-red-700">
                        Motivo do cancelamento
                      </p>
                      <p className="text-sm text-red-600">
                        {selectedAppointment.cancellationReason}
                      </p>
                    </div>
                  )}

                {selectedAppointment.status !== "cancelled" &&
                  selectedAppointment.status !== "completed" && (
                    <div className="border-t pt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Motivo do cancelamento
                      </label>
                      <textarea
                        value={cancellationReason}
                        onChange={(e) => setCancellationReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                        rows={2}
                        placeholder="Informe o motivo do cancelamento..."
                      />
                      <button
                        onClick={handleCancelAppointment}
                        className="mt-3 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition"
                      >
                        Confirmar Cancelamento
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
