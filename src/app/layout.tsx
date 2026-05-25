import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JATune Production | Centro de Control Musical",
  description: "Dashboard ejecutivo para monitorear el motor de generación musical desplegado en Render.",
  keywords: ["JATune", "music generation", "suno", "render", "dashboard", "production"],
  creator: "JATune Production",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.className} min-h-screen overflow-x-hidden bg-slate-950 text-white antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
