import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import CitizenDashboard from './pages/CitizenDashboard';
import VendorDashboard from './pages/VendorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import BiddingPage from './pages/BiddingPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  if (user.role === 'vendor') return <Navigate to="/vendor" />;
  return <Navigate to="/citizen" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth mode="login" />} />
      <Route path="/register" element={<Auth mode="register" />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/citizen/*" element={<ProtectedRoute roles={['citizen']}><Layout role="citizen"><CitizenDashboard /></Layout></ProtectedRoute>} />
      <Route path="/vendor/*" element={<ProtectedRoute roles={['vendor']}><Layout role="vendor"><VendorDashboard /></Layout></ProtectedRoute>} />
      <Route path="/vendor/tender/:id" element={<ProtectedRoute roles={['vendor']}><Layout role="vendor"><BiddingPage /></Layout></ProtectedRoute>} />
      <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><Layout role="admin"><AdminDashboard /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
