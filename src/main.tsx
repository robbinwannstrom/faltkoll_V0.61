import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Hittade inte root-elementet (#root).');
  }

  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );

  // Signal to the index.html watchdog that React has mounted successfully
  (window as any).__faltkollAppMounted = true;
  try {
    const errBox = document.getElementById('faltkoll-init-error');
    if (errBox) errBox.style.display = 'none';
    const recBtn = document.getElementById('faltkoll-recovery-btn');
    if (recBtn) recBtn.style.display = 'none';
  } catch {}
} catch (error: any) {
  console.error('Kritiskt fel vid initiering av FältKoll:', error);
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height: 100vh; background-color: #121212; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; font-family: sans-serif; text-align: center; color: white;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background-color: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #ef4444; font-size: 24px;">⚠️</div>
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Kunde inte starta FältKoll</h2>
        <p style="font-size: 13px; color: #94a3b8; max-width: 320px; margin-bottom: 16px;">Ett fel inträffade vid start av appen. Detta kan bero på gammal webbläsarcache.</p>
        <div style="background: #1c1917; border: 1px solid #292524; border-radius: 8px; padding: 10px; font-size: 11px; font-family: monospace; color: #f87171; max-width: 360px; word-break: break-all; margin-bottom: 20px;">
          ${error?.message || String(error)}
        </div>
        <button onclick="if(window.__faltkollForceReset){window.__faltkollForceReset();}else{window.location.reload();}" style="background-color: #f97316; color: black; font-weight: bold; padding: 12px 24px; border-radius: 12px; border: none; font-size: 13px; cursor: pointer;">
          Starta om & rensa cache
        </button>
      </div>
    `;
  }
}

