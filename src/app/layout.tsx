import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ViewerProvider } from "@/lib/viewer";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bursar — Every naira accounted for",
  description:
    "A digital school administrator for Nigerian schools: student records, fees, and every payment accounted for in one place.",
  applicationName: "Bursar",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bursar",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d5c4a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ViewerProvider>
          <AppShell>{children}</AppShell>
        </ViewerProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
