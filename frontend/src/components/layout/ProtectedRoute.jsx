import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Bungkus route privat.
// - Tanpa token → 404, supaya alamat login yang disamarkan tidak terbongkar lewat redirect.
// - `roles` diisi → role lain dikembalikan ke beranda dashboard miliknya.
export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/404" replace />;
  }
  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
