import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "PlayLog — Твоя игровая библиотека",
  description: "Отслеживай пройденные игры, ставь оценки и делись мнением",
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
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}