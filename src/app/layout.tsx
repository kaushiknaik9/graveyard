import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Forge — Civic Pothole Monitoring',
  description: 'Verified road hazard reporting and municipal response',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">{children}</body>
    </html>
  );
}
