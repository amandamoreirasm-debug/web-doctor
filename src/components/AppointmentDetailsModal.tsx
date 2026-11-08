import type { Appointment } from "../types";
import { format } from "date-fns";
import {
  User,
  Phone,
  Calendar,
  Clock,
  MapPin,
  FileText,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  appointment: Appointment | null;
  onClose: () => void;
}

export function AppointmentDetailsModal({
  isOpen,
  appointment,
  onClose,
}: Props) {
  if (!isOpen || !appointment) return null;

  const getStatusConfig = () => {
    if (appointment.status === "completed") {
      return {
        icon: CheckCircle,
        color: "text-green-600",
        bg: "bg-green-50",
        label: "Realizada",
      };
    }
    return {
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      label: "Cancelada",
    };
  };

  const StatusIcon = getStatusConfig().icon;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">
            Detalhes da Consulta
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div
            className={`${getStatusConfig().bg} rounded-lg p-3 flex items-center gap-3`}
          >
            <StatusIcon size={20} className={getStatusConfig().color} />
            <span className={`font-medium ${getStatusConfig().color}`}>
              Consulta {getStatusConfig().label}
            </span>
          </div>

          {/* Paciente */}
          <div className="flex items-start gap-3 pb-3 border-b">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paciente</p>
              <p className="font-medium text-gray-900">
                {appointment.patientName}
              </p>
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                <Phone size={12} /> {appointment.patientPhone}
              </p>
            </div>
          </div>

          {/* Especialidade */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <User size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Especialidade</p>
              <p className="text-gray-900">{appointment.doctorSpecialty}</p>
            </div>
          </div>

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Calendar size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Data</p>
                <p className="text-gray-900">
                  {format(new Date(appointment.date), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Clock size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Horário</p>
                <p className="text-gray-900">{appointment.time}h</p>
              </div>
            </div>
          </div>

          {/* Local */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
              <MapPin size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Local</p>
              <p className="text-gray-900">{appointment.location}</p>
            </div>
          </div>

          {/* Observações */}
          {appointment.notes && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Observações</p>
                <p className="text-gray-900">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Motivo de cancelamento (se cancelado) */}
          {appointment.status === "cancelled" &&
            appointment.cancellationReason && (
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-red-700">
                  Motivo do cancelamento
                </p>
                <p className="text-sm text-red-600">
                  {appointment.cancellationReason}
                </p>
              </div>
            )}

          {/* Data de realização (se completado) */}
          {appointment.status === "completed" && appointment.completedAt && (
            <div className="text-xs text-gray-500 border-t pt-3 mt-2">
              Registrado em:{" "}
              {format(
                new Date(appointment.completedAt),
                "dd/MM/yyyy 'às' HH:mm",
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
