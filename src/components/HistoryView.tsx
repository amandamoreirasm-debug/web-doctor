import { useState, useEffect, useMemo } from "react";
import { fetchDoctorHistory } from "../services/appointmentService";
import type { Appointment } from "../types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Calendar,
  User,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
// import { AppointmentDetailsModal } from "./AppointmentDetailsModal";
import { useAuth } from "../context/AuthContext";
import { AppointmentDetailsModal } from "./AppointmentDetailsModal";

type HistoryStatusFilter = "all" | "completed" | "cancelled";
type PeriodFilter = "all" | "week" | "month" | "year";

export default function HistoryView() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 1. Buscar doctorId
  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
  }, [user?.email]);

  // 2. Buscar histórico (sem real-time, apenas uma vez)
  useEffect(() => {
    if (!user?.email) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const history = await fetchDoctorHistory(user.uid);
        setAppointments(history);
      } catch (error) {
        console.error("Erro ao carregar histórico:", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user?.uid]);

  // 3. Filtrar agendamentos
  const filteredAppointments = useMemo(() => {
    let filtered = [...appointments];

    // Filtro por status
    if (statusFilter !== "all") {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }

    // Filtro por período
    if (periodFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(today.getDate() - 7);
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(today.getMonth() - 1);
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      filtered = filtered.filter((apt) => {
        const aptDate = new Date(apt.date);
        if (periodFilter === "week") return aptDate >= oneWeekAgo;
        if (periodFilter === "month") return aptDate >= oneMonthAgo;
        if (periodFilter === "year") return aptDate >= oneYearAgo;
        return true;
      });
    }

    // Busca por paciente
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.patientName.toLowerCase().includes(term) ||
          apt.patientPhone.includes(term) ||
          apt.doctorSpecialty.toLowerCase().includes(term),
      );
    }

    // Ordenar por data (mais recente primeiro)
    filtered.sort((a, b) =>
      `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`),
    );

    return filtered;
  }, [appointments, statusFilter, periodFilter, searchTerm]);

  // 4. Paginação
  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // 5. Estatísticas do histórico
  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter(
      (a) => a.status === "completed",
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === "cancelled",
    ).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Consultas por mês (últimos 6 meses)
    const last6Months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = format(month, "MMM/yyyy", { locale: ptBR });
      const count = appointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return (
          aptDate.getMonth() === month.getMonth() &&
          aptDate.getFullYear() === month.getFullYear() &&
          apt.status === "completed"
        );
      }).length;
      last6Months.unshift({ month: monthStr, count });
    }

    return { total, completed, cancelled, completionRate, last6Months };
  }, [appointments]);

  const getStatusBadge = (status: Appointment["status"]) => {
    if (status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle size={12} /> Realizado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle size={12} /> Cancelado
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-500">Carregando histórico...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Histórico de Consultas
        </h2>
        <p className="text-gray-500">
          Consultas realizadas e canceladas • {user?.displayName}
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-gray-500 text-sm">Total de consultas</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm p-4">
          <p className="text-green-600 text-sm">Realizadas</p>
          <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-sm p-4">
          <p className="text-red-600 text-sm">Canceladas</p>
          <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
        </div>
        <div className="bg-blue-50 rounded-xl shadow-sm p-4">
          <p className="text-blue-600 text-sm">Taxa de conclusão</p>
          <p className="text-2xl font-bold text-blue-700">
            {stats.completionRate}%
          </p>
        </div>
      </div>

      {/* Gráfico simples de consultas por mês */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <h3 className="font-semibold text-gray-700 mb-3">
          Consultas realizadas por mês
        </h3>
        <div className="flex items-end gap-2 h-32">
          {stats.last6Months.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              <div
                className="w-full bg-green-500 rounded-t-lg transition-all duration-300"
                style={{
                  height: `${Math.min(80, (item.count / Math.max(...stats.last6Months.map((m) => m.count), 1)) * 80)}px`,
                }}
              />
              <span className="text-xs text-gray-500 mt-2">{item.month}</span>
              <span className="text-sm font-medium text-gray-700">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar por paciente, telefone ou especialidade..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as HistoryStatusFilter);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos os status</option>
              <option value="completed">Realizados</option>
              <option value="cancelled">Cancelados</option>
            </select>

            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as PeriodFilter);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todo período</option>
              <option value="week">Última semana</option>
              <option value="month">Último mês</option>
              <option value="year">Último ano</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de consultas */}
      <div className="space-y-4">
        {paginatedAppointments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500">Nenhum registro encontrado</p>
            <p className="text-sm text-gray-400 mt-1">
              Tente ajustar os filtros de busca
            </p>
          </div>
        ) : (
          paginatedAppointments.map((apt) => (
            <div
              key={apt.id}
              className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition"
            >
              <div className="flex flex-wrap justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {apt.patientName}
                    </h3>
                    {getStatusBadge(apt.status)}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={14} />
                      <span>
                        {format(new Date(apt.date), "dd/MM/yyyy")} às {apt.time}
                        h
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <User size={14} />
                      <span>{apt.doctorSpecialty}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone size={14} />
                      <span>{apt.patientPhone}</span>
                    </div>
                    {apt.notes && (
                      <div className="flex items-start gap-2 text-gray-600 col-span-2">
                        <FileText size={14} className="mt-0.5" />
                        <span className="text-sm">{apt.notes}</span>
                      </div>
                    )}
                  </div>

                  {apt.status === "cancelled" && apt.cancellationReason && (
                    <div className="mt-3 bg-red-50 p-2 rounded-lg">
                      <p className="text-xs text-red-600">
                        <span className="font-medium">
                          Motivo do cancelamento:
                        </span>{" "}
                        {apt.cancellationReason}
                      </p>
                    </div>
                  )}

                  {apt.status === "completed" && apt.completedAt && (
                    <div className="mt-3 text-xs text-gray-500">
                      ✓ Atendido em{" "}
                      {format(
                        new Date(apt.completedAt),
                        "dd/MM/yyyy 'às' HH:mm",
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedAppointment(apt)}
                  className="flex items-center gap-2 px-3 py-2 text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                >
                  <Eye size={16} /> Detalhes
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <AppointmentDetailsModal
        isOpen={!!selectedAppointment}
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
