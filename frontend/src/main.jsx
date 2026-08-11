import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@/i18n/index.js';
import '@/styles/globals.css';

/**
 * Self-heal for stale lazy chunks. After a redeploy, an already-open tab still
 * references the previous build's hashed chunk filenames, which no longer exist
 * on disk — so the next lazy route/import throws "error loading dynamically
 * imported module". Reload once (guarded by a session flag to avoid a loop) so
 * the tab picks up the fresh index.html + current chunks.
 */
function isChunkLoadError(message) {
  return /error loading dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    String(message || '')
  );
}
function reloadOnce() {
  const KEY = 'aurah360.chunkReloadedAt';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 10000) return; // already reloaded very recently — avoid a loop
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
}
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault();
  reloadOnce();
});
window.addEventListener('error', (e) => {
  if (isChunkLoadError(e?.message)) reloadOnce();
});
window.addEventListener('unhandledrejection', (e) => {
  if (isChunkLoadError(e?.reason?.message)) reloadOnce();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
