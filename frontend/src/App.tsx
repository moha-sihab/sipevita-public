import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout, ProtectedLayout } from './layouts/Layouts';
import { LoginPage } from './pages/LoginPage';
import { PublicVerifyPage } from './pages/PublicVerifyPage';
import { PpatDashboardPage } from './pages/PpatDashboardPage';
import { PengajuanFormPage } from './pages/PengajuanFormPage';
import { PengajuanDetailPage } from './pages/PengajuanDetailPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ApprovalPage } from './pages/ApprovalPage';
import { ApprovalDetailPage } from './pages/ApprovalDetailPage';
import { LogsPage } from './pages/LogsPage';
import { RiwayatPage } from './pages/RiwayatPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<PublicVerifyPage />} />
        <Route path="/verify" element={<PublicVerifyPage />} />
        <Route path="/public/verify" element={<PublicVerifyPage />} />
        <Route path="/riwayat" element={<RiwayatPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedLayout role="PPAT" />}>
        <Route path="/ppat/dashboard" element={<PpatDashboardPage />} />
        <Route path="/ppat/pengajuan" element={<PengajuanFormPage />} />
        <Route path="/ppat/pengajuan/:id" element={<PengajuanDetailPage />} />
        <Route path="/ppat/riwayat" element={<RiwayatPage />} />
      </Route>

      <Route element={<ProtectedLayout role="ATR_BPN" />}>
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/approval" element={<ApprovalPage />} />
        <Route path="/admin/approval/:id" element={<ApprovalDetailPage />} />
        <Route path="/admin/riwayat" element={<RiwayatPage />} />
        <Route path="/admin/log-audit" element={<LogsPage />} />
      </Route>

      <Route path="/dashboard" element={<Navigate to="/ppat/dashboard" replace />} />
      <Route path="/admin-dashboard" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/pengajuan" element={<Navigate to="/ppat/pengajuan" replace />} />
      <Route path="/approval" element={<Navigate to="/admin/approval" replace />} />
      <Route path="/log-audit" element={<Navigate to="/admin/log-audit" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
