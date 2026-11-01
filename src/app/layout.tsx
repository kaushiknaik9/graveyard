import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Forge — Road Hazard & Pothole Reporting',
  description: 'Report road potholes and hazards instantly. Automatically verified and routed to the nearest Municipal Corporation for rapid repair.',
  icons: {
    icon: '/Logo.png',
    shortcut: '/Logo.png',
    apple: '/Logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <body className="bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased min-h-screen selection:bg-[#F7D10C] selection:text-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)]">
              <Navbar />
              <div className="flex-1">
                {children}
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
