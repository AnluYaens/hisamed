import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hisamed — Historia Clínica Electrónica",
  description:
    "Sistema de historia clínica electrónica para ginecología y medicina reproductiva",
  // iOS standalone install metadata (apple-touch-icon + add-to-home-screen).
  appleWebApp: {
    capable: true,
    title: "Hisamed",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // `cover` lets the app paint into the iOS safe-area (notch / home indicator).
  // Deliberately no `maximumScale` / `userScalable` — pinch-zoom stays enabled
  // for accessibility; iOS auto-zoom is prevented via 16px inputs in globals.css.
  viewportFit: "cover",
  themeColor: "#0d9488", // teal-600 — matches the manifest theme_color
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
