import { AlertCircle, Loader2, SearchX } from 'lucide-react';

export function LoadingState({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <div className="state">
      <Loader2 className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state error-state">
      <AlertCircle size={22} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ message = 'Belum ada data.' }: { message?: string }) {
  return (
    <div className="state">
      <SearchX size={22} />
      <span>{message}</span>
    </div>
  );
}
