import { useState } from "react";
import { createNotificationDocument } from "../services/cloudFunctionService";
import { fetchDoctorByEmail } from "../services/doctorService";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export function NotificationTest() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("Teste de Notificação");
  const [body, setBody] = useState(
    "Esta é uma notificação de teste do sistema médico",
  );

  const handleSendNotification = async () => {
    if (!user?.email) {
      toast.error("Usuário não autenticado");
      return;
    }

    setLoading(true);
    try {
      // Buscar o médico logado
      console.log("user medico: ", user.email);
      const doctor = await fetchDoctorByEmail(user.email);
      if (!doctor) {
        toast.error("Médico não encontrado");
        return;
      }

      // Criar documento de notificação (trigger automático)
      const notificationId = await createNotificationDocument({
        doctorId: doctor.id,
        title,
        body,
        data: {
          type: "test",
          click_action: "/dashboard",
        },
      });

      toast.success(`Notificação enviada! ID: ${notificationId}`);
      console.log("Notificação criada com ID:", notificationId);
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast.error("Erro ao enviar notificação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
      <h3 className="text-lg font-semibold text-blue-900 mb-3">
        Teste de Notificações FCM
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-1">
            Título
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-blue-800 mb-1">
            Mensagem
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSendNotification}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Enviando..." : "Enviar Notificação de Teste"}
        </button>
      </div>
      <p className="text-xs text-blue-600 mt-2">
        Isso criará um documento na coleção 'notifications' que acionará a Cloud
        Function automaticamente.
      </p>
    </div>
  );
}
