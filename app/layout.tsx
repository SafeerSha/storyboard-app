import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StoryBoard",
  description: "Turn vague client requirements into clear, approved feature stories."
};

export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
