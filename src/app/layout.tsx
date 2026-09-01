import type { Metadata, Viewport } from "next";
import { ContenitoreToast } from "@/components/ui/toast";
import "./globals.css";

const DESCRIZIONE =
  "Il cruscotto economico, fiscale e finanziario del libero professionista italiano. I dati restano nel tuo browser.";

export const metadata: Metadata = {
  title: "Freelance Flow",
  description: DESCRIZIONE,
  applicationName: "Freelance Flow",
  openGraph: {
    title: "Freelance Flow",
    description: DESCRIZIONE,
    siteName: "Freelance Flow",
    locale: "it_IT",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F4F9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <ContenitoreToast />
      </body>
    </html>
  );
}
