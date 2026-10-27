"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/admin/icon";
import { PWA_INSTALL_AVAILABLE, PWA_INSTALLED } from "@/components/pwa/pwa-events";

type InstallState = "checking" | "available" | "installed" | "ios" | "manual";

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

function fallbackState(): InstallState {
  if (window.__floristAppInstalled || isStandalone()) return "installed";
  const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return isIos ? "ios" : "manual";
}

export function InstallAppCard() {
  const state = useSyncExternalStore(
    (notify) => {
      const displayMode = window.matchMedia("(display-mode: standalone)");
      window.addEventListener(PWA_INSTALL_AVAILABLE, notify);
      window.addEventListener(PWA_INSTALLED, notify);
      displayMode.addEventListener("change", notify);
      return () => {
        window.removeEventListener(PWA_INSTALL_AVAILABLE, notify);
        window.removeEventListener(PWA_INSTALLED, notify);
        displayMode.removeEventListener("change", notify);
      };
    },
    () => (window.__floristInstallPrompt ? "available" : fallbackState()),
    () => "checking",
  );

  async function install() {
    const prompt = window.__floristInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    delete window.__floristInstallPrompt;
    if (choice.outcome === "accepted") {
      window.__floristAppInstalled = true;
      window.dispatchEvent(new Event(PWA_INSTALLED));
    } else {
      window.dispatchEvent(new Event(PWA_INSTALL_AVAILABLE));
    }
  }

  const copy = {
    checking: "Đang kiểm tra khả năng cài đặt trên thiết bị này...",
    available: "Cài để mở nhanh từ màn hình chính và sử dụng giao diện toàn màn hình.",
    installed: "Ứng dụng đã được cài trên thiết bị này.",
    ios: "Trên iPhone/iPad: mở bằng Safari, chọn Chia sẻ rồi chọn Thêm vào Màn hình chính.",
    manual: "Mở menu trình duyệt và chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.",
  }[state];

  return (
    <section className="section" aria-labelledby="install-app-heading">
      <div className="pwa-card">
        <span className="pwa-card-icon" aria-hidden="true">
          <Icon name="download" className="icon-lg" />
        </span>
        <div className="pwa-card-copy">
          <span className="pwa-eyebrow">Ứng dụng điện thoại</span>
          <h2 id="install-app-heading">Cài Bích Ngọc Florist</h2>
          <p>{copy}</p>
        </div>
        {state === "available" ? (
          <button className="btn btn-ink pwa-install-button" type="button" onClick={install}>
            <Icon name="download" className="icon-sm" />
            Cài ứng dụng
          </button>
        ) : (
          <span className={`pwa-state pwa-state-${state}`} role="status">
            {state === "installed" ? "Đã cài đặt" : state === "checking" ? "Đang kiểm tra" : "Hướng dẫn cài đặt"}
          </span>
        )}
      </div>
    </section>
  );
}
