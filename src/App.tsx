import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import MainLayout from "./layouts/MainLayout";
import DoctorDashboard from "./components/DoctorDashboard";
import DailySchedule from "./components/DailySchedule";
import WeeklySchedule from "./components/WeeklySchedule";
import HistoryView from "./components/HistoryView";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";
import { NotificationHandler } from "./components/NotificationHandler";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <NotificationHandler />
      <MainLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DoctorDashboard />} />
          <Route path="/schedule/daily" element={<DailySchedule />} />
          <Route path="/schedule/weekly" element={<WeeklySchedule />} />
          <Route path="/history" element={<HistoryView />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
