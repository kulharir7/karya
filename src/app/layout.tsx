import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Karya — AI Computer Agent",
  description: "AI that actually DOES things on your computer",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
