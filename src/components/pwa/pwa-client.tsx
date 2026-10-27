"use client";

import { useEffect } from "react";
import { PWA_INSTALL_AVAILABLE, PWA_INSTALLED, type BeforeInstallPromptEvent } from "@/components/pwa/pwa-events";

export function PwaClient() {
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__floristInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(PWA_INSTALL_AVAILABLE));
    };
    const markInstalled = () => {
      delete window.__floristInstallPrompt;
      window.__floristAppInstalled = true;
      window.dispatchEvent(new Event(PWA_INSTALLED));
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => registration.update()).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  return null;
}
