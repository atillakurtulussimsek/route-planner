import { Geist } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Rota Planlayıcı — Teslimat Optimizasyonu",
  description:
    "Lojistik teslimatlar için açık kaynaklı (Nominatim + OSRM) rota optimizasyon aracı.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-900">{children}</body>
    </html>
  );
}
