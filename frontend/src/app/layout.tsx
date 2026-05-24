import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display, DM_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Assignly — Task Management",
  description: "A calm, beautiful, and productive workspace for your team. Assign, track, and complete tasks with ease.",
};

import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'var(--cream-50)',
              border: '1px solid var(--cream-300)',
              color: 'var(--warm-text)',
              borderRadius: '14px',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 12px 36px rgba(60,35,10,0.08)',
              padding: '12px 18px',
            },
            success: {
              iconTheme: {
                primary: 'var(--sage-mid)',
                secondary: '#FAF6EE',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--rose-mid)',
                secondary: '#FAF6EE',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
