import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PlayLog - Твоя игровая библиотека',
  description: 'Отслеживай свои игры, оценивай и делись впечатлениями',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}