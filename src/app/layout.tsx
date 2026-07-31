import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { ViewerProvider } from "@/lib/viewer";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Display face — warm, characterful grotesque for headings and large figures.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
// Body + tabular money — clean neutral sans with open zeros.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
  themeColor: "#1b2a3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ViewerProvider>
          <AppShell>{children}</AppShell>
        </ViewerProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
