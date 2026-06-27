import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-prompt-dismissed');
      if (!dismissed) setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', '1');
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 card-glass p-4 safe-bottom">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-neon/20 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-neon" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Install AdPadz</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Add to your home screen for the best experience.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={install} className="btn-primary text-xs px-4 py-1.5">Install</button>
            <button onClick={dismiss} className="btn-ghost text-xs">Later</button>
          </div>
        </div>
        <button onClick={dismiss} className="text-[var(--text-muted)] hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
