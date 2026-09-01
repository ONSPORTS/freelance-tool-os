import type { MetadataRoute } from "next";

/**
 * Il manifest serve a una cosa sola: se qualcuno installa l'app sul telefono o
 * la aggiunge alla home, deve chiamarsi Freelance Flow e aprirsi a schermo
 * pieno. I colori sono i token di `globals.css` — sfondo e inchiostro.
 */
// Con `output: "export"` una route di metadata va dichiarata statica in modo
// esplicito, altrimenti Next la tratta come dinamica e il build fallisce.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Freelance Flow",
    short_name: "Freelance Flow",
    description:
      "Il cruscotto economico, fiscale e finanziario del libero professionista italiano. I dati restano nel tuo browser.",
    lang: "it",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F4F9",
    theme_color: "#F2F4F9",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
