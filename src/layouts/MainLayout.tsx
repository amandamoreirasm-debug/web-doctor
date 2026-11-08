import type { ReactNode } from "react";
// import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  Clock,
  History,
  LogOut,
  LayoutDashboard,
  HeartPulse,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  console.log("Current user:", user);

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/schedule/daily", label: "Agenda Diária", icon: Calendar },
    { path: "/schedule/weekly", label: "Agenda Semanal", icon: Clock },
    { path: "/history", label: "Histórico", icon: History },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/dashboard")}
          >
            <HeartPulse className="text-green-600" size={28} />
            <h1 className="text-xl font-bold text-gray-800">Web Doctor</h1>
          </div>
          <div className="flex items-center gap-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition ${
                    isActive
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
            <div className="flex items-center gap-3 pl-4 border-l">
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-600 hover:text-red-800"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
