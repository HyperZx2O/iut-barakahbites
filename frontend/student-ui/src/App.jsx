import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuth } from './context/AuthContext';

import AdminLoginPage from './admin/pages/AdminLoginPage';
import AdminDashboard from './admin/pages/Dashboard';
import { useAdminAuth } from './admin/context/AdminAuthContext';

export default function App() {
  const { token: studentToken } = useAuth();
  const { token: adminToken } = useAdminAuth();

  return (
    <Routes>
      {/* Student Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={studentToken ? <DashboardPage /> : <Navigate to="/login" replace />}
      />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin/dashboard"
        element={adminToken ? <AdminDashboard /> : <Navigate to="/admin/login" replace />}
      />

      {/* Redirects */}
      <Route path="/admin" element={<Navigate to={adminToken ? '/admin/dashboard' : '/admin/login'} replace />} />
      <Route path="*" element={<Navigate to={studentToken ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
