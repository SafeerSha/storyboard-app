import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GlobalLoader } from "@/components/GlobalLoader";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "StoryBoard",
  description: "Turn vague client requirements into clear, approved feature stories."
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>
        <GlobalLoader />
        {children}
      </body>
    </html>
  );
}
