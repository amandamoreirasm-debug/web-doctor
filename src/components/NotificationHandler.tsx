import { useEffect } from "react";
import {
  onMessageListener,
  requestNotificationPermission,
  saveDoctorFCMToken,
} from "../services/notificationService";
import { fetchDoctorByEmail } from "../services/doctorService";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export function NotificationHandler() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.email) return;

    const setupNotifications = async () => {
      // 1. Solicitar permissão e obter token
      const token = await requestNotificationPermission();

      if (token) {
        // 2. Salvar token no Firestore para este médico
        const doctor = await fetchDoctorByEmail(user.email!);
        if (doctor) {
          await saveDoctorFCMToken(doctor.id, token);
        }
      }

      // 3. Escutar mensagens em primeiro plano
      const unsubscribe = onMessageListener((payload) => {
        console.log("Notificação recebida:", payload);

        // Mostrar toast com a mensagem
        const title = payload.notification?.title || "Nova notificação";
        const body = payload.notification?.body || "";

        toast.custom((t) => (
          <div
            className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    🔔
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-sm text-gray-500">{body}</p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none"
              >
                Fechar
              </button>
            </div>
          </div>
        ));
      });

      return () => unsubscribe();
    };

    setupNotifications();
  }, [user?.email]);

  return null;
}
