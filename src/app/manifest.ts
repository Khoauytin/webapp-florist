import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Bích Ngọc Florist - Quản lý",
    short_name: "Bích Ngọc",
    description: "Quản lý sản phẩm, khách hàng và đơn hoa của Bích Ngọc Florist.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#f8f5fb",
    theme_color: "#1f4f8f",
    lang: "vi",
    categories: ["business", "productivity", "shopping"],
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Tổng quan", short_name: "Tổng quan", url: "/admin", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192" }] },
      { name: "Lịch giao hoa", short_name: "Lịch", url: "/admin/calendar", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192" }] },
      { name: "Tạo đơn mới", short_name: "Tạo đơn", url: "/admin/orders/new", icons: [{ src: "/icons/pwa-192.png", sizes: "192x192" }] },
    ],
  };
}
