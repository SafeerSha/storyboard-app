import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GlobalLoader } from "@/components/GlobalLoader";
import { ToastProvider } from "@/components/ui/Toast";
import { PWAProvider } from "@/components/PWAProvider";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PWAReloadButton } from "@/components/PWAReloadButton";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#CCA038",
};

export const metadata: Metadata = {
  title: "REQly",
  description: "From requirements to delivery.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "REQly",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <GlobalLoader />
        <ToastProvider />
        <PWAProvider>
          {children}
          <InstallPrompt />
          <PWAReloadButton />
        </PWAProvider>
      </body>
    </html>
  );
}
