import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '../config/env';

type TurnstileAppearance = 'always' | 'execute' | 'interaction-only';

interface TurnstileWidgetProps {
  action: string;
  disabled?: boolean;
  onTokenChange: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          appearance?: TurnstileAppearance;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = () => {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
  ({ action, disabled = false, onTokenChange, onExpired, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptError, setScriptError] = useState('');

    useImperativeHandle(ref, () => ({
      reset: () => {
        onTokenChange('');
        if (TURNSTILE_ENABLED && widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!TURNSTILE_ENABLED || disabled || !TURNSTILE_SITE_KEY || !containerRef.current) return undefined;

      let cancelled = false;

      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            action,
            appearance: 'always',
            callback: (token) => onTokenChange(token),
            'expired-callback': () => {
              onTokenChange('');
              onExpired?.();
            },
            'error-callback': () => {
              onTokenChange('');
              onError?.();
            },
          });
        })
        .catch(() => {
          setScriptError('Widget verifikasi gagal dimuat. Muat ulang halaman dan coba lagi.');
          onTokenChange('');
          onError?.();
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    }, [action, disabled, onError, onExpired, onTokenChange]);

    if (!TURNSTILE_ENABLED) return null;

    if (!TURNSTILE_SITE_KEY) {
      return (
        <p className="turnstile-message">
          Konfigurasi Turnstile belum tersedia. Hubungi administrator sistem.
        </p>
      );
    }

    return (
      <div className="turnstile-block">
        <div ref={containerRef} />
        {scriptError && <p className="turnstile-message">{scriptError}</p>}
      </div>
    );
  },
);

TurnstileWidget.displayName = 'TurnstileWidget';
