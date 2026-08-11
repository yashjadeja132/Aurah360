import { useEffect, useState, useCallback } from 'react';

/**
 * Global Ctrl+K / Cmd+K listener for the command palette. Mounted once at the app-shell level
 * (AppLayout) so it's live on every authenticated page, not re-registered per-page.
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      const isCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCombo) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => setOpen(true), []);

  return { open, setOpen, close, show };
}

export default useCommandPalette;
