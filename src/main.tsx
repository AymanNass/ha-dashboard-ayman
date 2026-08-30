import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';
import { applyTheme, getSettings, hydrateConnectionFromServer, hydrateSettingsFromServer } from './settings';
import { refreshConnection } from './config';
import { installHaptics } from './lib/haptics';
import './styles/theme.css';

applyTheme();
installHaptics();

// ── Debug overlay for runtime errors (visible on-screen) ──
if (import.meta.env.DEV) {
  const showErr = (msg: string) => {
    let box = document.getElementById('__dbg');
    if (!box) {
      box = document.createElement('pre');
      box.id = '__dbg';
      box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;max-height:40vh;overflow:auto;background:rgba(0,0,0,0.92);color:#f87171;font:12px/1.5 monospace;padding:12px;pointer-events:auto;white-space:pre-wrap;';
      document.body.appendChild(box);
    }
    box.textContent += msg + '\n\n';
  };
  window.addEventListener('error', (e) => showErr(`[ERROR] ${e.message}\n  at ${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', (e) => showErr(`[UNHANDLED] ${e.reason}`));
  console.log('[Glance debug] ENV token present:', !!import.meta.env.VITE_HA_TOKEN);
  console.log('[Glance debug] Settings token present:', !!getSettings().haToken);
  console.log('[Glance debug] Effective token present:', !!getSettings().haToken || !!import.meta.env.VITE_HA_TOKEN);
  console.log('[Glance debug] HA URL:', getSettings().haUrl || import.meta.env.VITE_HA_URL || '(none)');
}

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Before the first render: adopt the server's shared preferences (issue #8 —
// theme/accent/etc.; hydrate re-applies the theme via saveSettings) and, when
// this device has no local token, the opt-in shared connection so it
// auto-connects. Both are same-origin fetches that fail fast; never blocks long.
const boot: Promise<unknown>[] = [hydrateSettingsFromServer()];
if (!getSettings().haToken) {
  boot.push(
    hydrateConnectionFromServer().then((applied) => {
      if (applied) refreshConnection();
    }),
  );
}
Promise.allSettled(boot).finally(render);
