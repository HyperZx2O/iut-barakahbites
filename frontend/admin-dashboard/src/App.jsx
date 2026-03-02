import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import { useAdminAuth } from './context/AdminAuthContext';

export default function App() {
  const { token } = useAdminAuth();

  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route
        path="/"
        element={token ? <Dashboard /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
