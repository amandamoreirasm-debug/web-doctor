import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase/config";
import toast from "react-hot-toast";
import { Stethoscope } from "lucide-react";
import { createDoctor, fetchDoctorByEmail } from "../services/doctorService";
import {
  registerAndSaveDoctorToken,
  getDeviceInfo,
} from "../services/notificationService";
import { getToken } from "firebase/messaging";
import { messaging } from "../firebase/config";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let userCredential;

      if (isRegister) {
        // 1. Criar usuário no Auth
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        toast.success("Cadastro realizado com sucesso!");

        // 2. Obter token FCM antes de criar o documento
        let fcmToken = null;
        try {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          fcmToken = await getToken(messaging!, { vapidKey });
          console.log(
            "✅ Token FCM obtido para cadastro:",
            fcmToken?.slice(0, 20) + "...",
          );
        } catch (tokenError) {
          console.warn(
            "⚠️ Não foi possível obter token FCM durante cadastro:",
            tokenError,
          );
        }

        // 3. Criar documento do médico no Firestore com fcmTokens
        const doctorData: any = {
          email: email,
          name: email.split("@")[0],
          specialty: "Especialidade não definida",
          crm: "",
          location: "Local não definido",
          rating: 0,
          experience: "",
          avatar: "👨‍⚕️",
        };

        // Adicionar fcmTokens se o token foi obtido
        if (fcmToken) {
          doctorData.fcmTokens = {
            [fcmToken]: {
              device: getDeviceInfo(),
              lastUsed: new Date().toISOString(),
            },
          };
        }

        await createDoctor(userCredential.user.uid, doctorData);
        console.log("✅ Médico criado no Firestore");
      } else {
        // Login
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        toast.success("Login realizado!");
      }

      // 3. Registrar token FCM (após login ou cadastro)
      const user = userCredential.user;
      console.log("user logged in", user);
      await registerAndSaveDoctorToken(user.uid);

      // 4. Verificar se o médico existe no Firestore (para login)
      if (!isRegister) {
        const doctor = await fetchDoctorByEmail(email);
        if (!doctor) {
          // Se não existir, criar automaticamente (fallback)
          let fcmToken = null;
          try {
            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            fcmToken = await getToken(messaging!, { vapidKey });
            console.log(
              "✅ Token FCM obtido para criação automática:",
              fcmToken?.slice(0, 20) + "...",
            );
          } catch (tokenError) {
            console.warn(
              "⚠️ Não foi possível obter token FCM durante criação automática:",
              tokenError,
            );
          }

          const doctorData: any = {
            email: email,
            name: email.split("@")[0],
            specialty: "Especialidade não definida",
            crm: "",
            location: "Local não definido",
            rating: 0,
            experience: "",
            avatar: "👨‍⚕️",
          };

          // Adicionar fcmTokens se o token foi obtido
          if (fcmToken) {
            doctorData.fcmTokens = {
              [fcmToken]: {
                device: getDeviceInfo(),
                lastUsed: new Date().toISOString(),
              },
            };
          }

          await createDoctor(user.uid, doctorData);
          console.log("✅ Médico criado automaticamente no login");
        } else {
          console.log(
            "✅ Médico já existe no Firestore, token FCM foi registrado via Cloud Function",
          );
        }
      }
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <Stethoscope size={32} className="text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800">
          {isRegister ? "Cadastro de Médico" : "Acesso Médico"}
        </h2>
        <p className="text-center text-gray-500 mb-6">
          {isRegister
            ? "Cadastre-se para gerenciar sua agenda"
            : "Gerencie seus horários e pacientes"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Carregando..." : isRegister ? "Cadastrar" : "Entrar"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-blue-600 hover:underline"
          >
            {isRegister ? "Já tenho conta" : "Não tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
