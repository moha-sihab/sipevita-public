import { useCallback, useRef, useState } from 'react';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../components/TurnstileWidget';
import { TURNSTILE_ENABLED } from '../config/env';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);

  const resetTurnstile = useCallback(() => {
    turnstileRef.current?.reset();
  }, []);

  const handleTurnstileError = useCallback(() => {
    setError('Verifikasi CAPTCHA gagal. Coba muat ulang halaman atau ulangi login.');
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (TURNSTILE_ENABLED && !turnstileToken.trim()) {
      setError('Selesaikan verifikasi CAPTCHA terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await login(username, password, turnstileToken);
      navigate(user.peran === 'ATR_BPN' ? '/admin/dashboard' : '/ppat/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setLoading(false);
      resetTurnstile();
    }
  };

  const turnstileRequired = TURNSTILE_ENABLED;
  const turnstileVerified = !turnstileRequired || Boolean(turnstileToken.trim());
  const canSubmit = Boolean(username.trim()) && Boolean(password) && turnstileVerified && !loading;

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Login Pengguna Sistem</h1>
        <p>Masuk menggunakan akun resmi PPAT atau petugas ATR/BPN.</p>

        <form onSubmit={submit} className="form-grid">
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                value={password}
                type={showPassword ? 'text' : 'password'}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <div className="alert danger">{error}</div>}
          <TurnstileWidget
            ref={turnstileRef}
            action="login"
            disabled={loading}
            onTokenChange={setTurnstileToken}
            onExpired={resetTurnstile}
            onError={handleTurnstileError}
          />
          <button
            className="primary-button"
            disabled={!canSubmit}
          >
            <LogIn size={18} />
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
        <div className="alert warning">
          Halaman ini hanya untuk Notaris/PPAT dan petugas ATR/BPN yang terdaftar.
        </div>
      </div>
    </section>
  );
}
