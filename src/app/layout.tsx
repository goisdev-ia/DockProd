import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DockProd - Da doca ao resultado",
  description: "Sistema de gestão de produtividade de recebimento na doca - grupo Docemel",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DockProd",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/AppImages/android/android-launchericon-192-192.png", sizes: "192x192", type: "image/png" },
      { url: "/AppImages/android/android-launchericon-512-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/AppImages/ios/180.png", sizes: "180x180", type: "image/png" },
      { url: "/AppImages/ios/152.png", sizes: "152x152", type: "image/png" },
      { url: "/AppImages/ios/120.png", sizes: "120x120", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1a3d1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-right" />
        <PwaRegister />
      </body>
    </html>
  );
}
