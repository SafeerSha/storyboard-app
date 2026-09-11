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
  themeColor: "#B8944E",
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
    apple: "/icon.svg",
  }
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
