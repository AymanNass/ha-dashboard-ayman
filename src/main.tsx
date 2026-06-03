import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, getSettings, hydrateConnectionFromServer } from './settings';
import { refreshConnection } from './config';
import { installHaptics } from './lib/haptics';
import './styles/theme.css';

applyTheme();
installHaptics();

const root = createRoot(document.getElementById('root')!);

function render() {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// If this device has no local token, try adopting a server-shared connection
// (opt-in) before the first render so it auto-connects. Never blocks for long.
if (getSettings().haToken) {
  render();
} else {
  hydrateConnectionFromServer()
    .then((applied) => {
      if (applied) refreshConnection();
    })
    .finally(render);
}
