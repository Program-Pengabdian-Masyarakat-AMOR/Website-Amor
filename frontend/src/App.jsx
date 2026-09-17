import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import { useAuth } from './context/AuthContext';
import { LOGIN_PATH } from './lib/roles';
import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import DashboardHome from './pages/dashboard/DashboardHome';
import MonitoringLog from './pages/dashboard/MonitoringLog';
import Kontrol from './pages/dashboard/Kontrol';
import HealthCheck from './pages/dashboard/HealthCheck';
import Members from './pages/dashboard/Members';
import Sales from './pages/dashboard/Sales';
import SystemStatus from './pages/dashboard/SystemStatus';
import Rekap from './pages/dashboard/Rekap';
import ManagementHome from './pages/dashboard/ManagementHome';
import KontenPublik from './pages/dashboard/KontenPublik';
import NotFound from './pages/NotFound';

// Beranda /dashboard berbeda per role.
function RoleHome() {
  const { role } = useAuth();
  if (role === 'admin') return <SystemStatus />;
  if (role === 'management') return <ManagementHome />;
  if (role === 'operator') return <DashboardHome />;
  return <Navigate to="/404" replace />;
}

const only = (roles, element) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      {/* Publik */}
      <Route path="/" element={<Landing />} />
      <Route path={LOGIN_PATH} element={<Login />} />

      {/* Privat — di balik ProtectedRoute + DashboardLayout, tiap halaman dikunci per role */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleHome />} />

        {/* Admin */}
        <Route path="health" element={only(['admin'], <HealthCheck />)} />
        <Route path="rekap" element={only(['admin'], <Rekap />)} />
        <Route path="members" element={only(['admin'], <Members />)} />

        {/* Operator */}
        <Route path="monitoring" element={only(['operator'], <MonitoringLog />)} />
        <Route path="kontrol" element={only(['operator'], <Kontrol />)} />

        {/* Management */}
        <Route path="sales" element={only(['management'], <Sales />)} />
        <Route path="konten" element={only(['management'], <KontenPublik />)} />
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
