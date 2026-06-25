import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '../components/Header';
import { Footer } from '../components/Footer';
import { LoadingState } from '../components/State';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/api';

export function PublicLayout() {
  return (
    <div className="app-shell">
      <AppHeader role="public" />
      <main className="main-area">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function ProtectedLayout({ role }: { role: UserRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Memeriksa sesi..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.peran !== role) {
    return <Navigate to={user.peran === 'ATR_BPN' ? '/admin/dashboard' : '/ppat/dashboard'} replace />;
  }

  return (
    <div className="app-shell">
      <AppHeader role={role} />
      <main className="main-area">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
