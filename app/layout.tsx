import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "PlayLog — Твоя игровая библиотека",
  description: "Отслеживай пройденные игры, ставь оценки и делись мнением",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PlayLog",
  },
  formatDetection: {
    telephone: false,
  },
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
      <head>
        {/* PWA: iOS мета-теги */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PlayLog" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* PWA:.theme-color для Android */}
        <meta name="theme-color" content="#6366f1" />
        
        {/* PWA: регистрация Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('[PlayLog] SW registered:', registration.scope);
                    },
                    function(error) {
                      console.log('[PlayLog] SW registration failed:', error);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ToastProvider>
          <AuthProvider>
            <Header />
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
