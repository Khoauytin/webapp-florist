export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __floristInstallPrompt?: BeforeInstallPromptEvent;
    __floristAppInstalled?: boolean;
  }
}

export const PWA_INSTALL_AVAILABLE = "florist-pwa-install-available";
export const PWA_INSTALLED = "florist-pwa-installed";
