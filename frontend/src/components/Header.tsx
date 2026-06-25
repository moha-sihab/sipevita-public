import { Link, NavLink } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/api';

const ppatLinks = [
  ['Dashboard', '/ppat/dashboard'],
  ['Pengajuan', '/ppat/pengajuan'],
  ['Riwayat', '/ppat/riwayat'],
] as const;

const adminLinks = [
  ['Dashboard', '/admin/dashboard'],
  ['Approval', '/admin/approval'],
  ['Riwayat', '/admin/riwayat'],
  ['Log Audit', '/admin/log-audit'],
] as const;

function HeaderLink({ to, children }: { to: string; children: string }) {
  return (
    <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to={to}>
      {children}
    </NavLink>
  );
}

export function AppHeader({ role }: { role?: UserRole | 'public' }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = role === 'ATR_BPN' ? adminLinks : role === 'PPAT' ? ppatLinks : [];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to={user?.peran === 'ATR_BPN' ? '/admin/dashboard' : user ? '/ppat/dashboard' : '/'}>
          <Logo />
        </Link>
        <button className="icon-button mobile-only" onClick={() => setOpen((value) => !value)}>
          <Menu size={20} />
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          {role === 'public' && (
            <>
              <HeaderLink to="/">Verifikasi</HeaderLink>
              <HeaderLink to="/riwayat">Riwayat</HeaderLink>
              <HeaderLink to="/login">Login</HeaderLink>
            </>
          )}
          {links.map(([label, to]) => (
            <HeaderLink key={to} to={to}>
              {label}
            </HeaderLink>
          ))}
          {user && (
            <button className="logout-button" onClick={logout}>
              <LogOut size={16} />
              Keluar
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
