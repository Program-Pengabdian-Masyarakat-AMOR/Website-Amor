import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import DashboardHome from './pages/dashboard/DashboardHome';
import MonitoringLog from './pages/dashboard/MonitoringLog';
import Kontrol from './pages/dashboard/Kontrol';
import HealthCheck from './pages/dashboard/HealthCheck';
import Members from './pages/dashboard/Members';
import Sales from './pages/dashboard/Sales';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* Publik */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      {/* Privat — di balik ProtectedRoute + DashboardLayout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="monitoring" element={<MonitoringLog />} />
        <Route path="kontrol" element={<Kontrol />} />
        <Route path="health" element={<HealthCheck />} />
        <Route path="members" element={<Members />} />
        <Route path="sales" element={<Sales />} />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
