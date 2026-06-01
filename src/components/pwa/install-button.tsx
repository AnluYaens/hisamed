'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// `beforeinstallprompt` is a Chromium-only, non-standard event not present in
// the DOM lib types. Minimal shape for what we use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Discreet "Instalar app" button. Only renders on browsers that support the
 * install prompt (`beforeinstallprompt` — Chromium) and only while an install
 * is actually available. Hidden when already installed (standalone) or once
 * the app has been installed this session. Never auto-shows a prompt or nags.
 */
export function InstallButton() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Already running as an installed PWA → nothing to offer.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's mini-infobar; we surface our own button instead.
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const onAppInstalled = () => {
      // Installed — retire the button for the rest of this session.
      deferredPrompt.current = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function handleClick() {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;

    // The prompt event can only be used once. Drop our reference either way.
    deferredPrompt.current = null;
    if (outcome === 'accepted') {
      // Hide immediately; `appinstalled` will also fire shortly.
      setCanInstall(false);
    }
    // If dismissed, leave the button visible — Chromium re-dispatches
    // `beforeinstallprompt` later, restocking a fresh event.
  }

  if (!canInstall) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      title="Instalar Hisamed como aplicación"
    >
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );
}
