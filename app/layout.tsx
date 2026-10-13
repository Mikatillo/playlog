import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";
import MobileNav from "@/components/MobileNav";
import PwaSetup from "@/components/PwaSetup";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const viewport: Viewport = {
  themeColor: "#171717",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "PlayLog",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PlayLog",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  title: "PlayLog — Твоя игровая библиотека",
  description: "Отслеживай пройденные игры, ставь оценки и делись мнением",
  openGraph: {
    title: "PlayLog — Твоя игровая библиотека",
    description: "Отслеживай пройденные игры, ставь оценки и делись мнением",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <ToastProvider>
          <AuthProvider>
            <Header />
            {/* Отступ снизу под мобильную навигацию */}
            <div className="pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
            <MobileNav />
            <PwaSetup />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}