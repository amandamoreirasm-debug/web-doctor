import { useState, useEffect, useMemo } from "react";
import { subscribeToDoctorAppointments } from "../services/appointmentService";
import type { Appointment } from "../types";
import { format } from "date-fns";
import { Calendar, Users, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NotificationTest } from "./NotificationTest";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    scheduled: 0,
    completed: 0,
  });

  const today = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email) return;

    console.log("🔄 Inscrevendo em tempo real para data:", today);

    // Subscribe em tempo real
    const unsubscribe = subscribeToDoctorAppointments(
      user.uid,
      today,
      (appointments) => {
        setTodayAppointments(appointments);

        const total = appointments.length;
        const confirmed = appointments.filter(
          (a) => a.status === "confirmed",
        ).length;
        const scheduled = appointments.filter(
          (a) => a.status === "scheduled",
        ).length;
        const completed = appointments.filter(
          (a) => a.status === "completed",
        ).length;

        setStats({ total, confirmed, scheduled, completed });
        setLoading(false);
      },
    );

    return () => {
      console.log("🧹 Removendo inscrição");
      unsubscribe();
    };
  }, [user?.uid, today]);

  const statCards = useMemo(
    () => [
      {
        label: "Consultas Hoje",
        value: stats.total,
        icon: Calendar,
        color: "bg-blue-500",
      },
      {
        label: "Confirmadas",
        value: stats.confirmed,
        icon: CheckCircle,
        color: "bg-green-500",
      },
      {
        label: "Agendadas",
        value: stats.scheduled,
        icon: Clock,
        color: "bg-yellow-500",
      },
      {
        label: "Realizadas",
        value: stats.completed,
        icon: Users,
        color: "bg-purple-500",
      },
      {
        label: "Canceladas",
        value:
          stats.total - stats.confirmed - stats.scheduled - stats.completed,
        icon: AlertCircle,
        color: "bg-red-500",
      },
    ],
    [stats.total, stats.confirmed, stats.scheduled, stats.completed],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-blue-500 ";
      case "scheduled":
        return "bg-yellow-500";
      case "completed":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>
        <p className="text-gray-500">
          Bem-vindo(a), {user?.displayName || "Médico"}! 👋
        </p>
      </div>

      {/* <NotificationTest /> */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {stat.value}
                  </p>
                </div>
                <div className={`${stat.color} p-3 rounded-full`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">
            Próximas consultas - Hoje
          </h3>
        </div>
        <div className="divide-y">
          {todayAppointments.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
              <AlertCircle size={18} /> Nenhuma consulta agendada para hoje
            </div>
          ) : (
            todayAppointments.map((apt) => (
              <div
                key={apt.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium text-gray-800">{apt.patientName}</p>
                  <p className="text-sm text-gray-500">
                    {apt.time} • {apt.patientPhone}
                  </p>
                  {apt.notes && (
                    <p className="text-xs text-gray-400 mt-1">{apt.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      apt.status,
                    )}`}
                  >
                    {apt.status === "confirmed" && "Confirmado"}
                    {apt.status === "scheduled" && "Agendado"}
                    {apt.status === "completed" && "Realizado"}
                    {apt.status === "cancelled" && "Cancelado"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
