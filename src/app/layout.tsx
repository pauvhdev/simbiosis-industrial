import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simbiosis Industrial Anónima",
  description:
    "Matchmaking B2B anónimo de subproductos industriales: publica una oferta o una demanda y encuentra la contraparte sin revelar tu identidad.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
