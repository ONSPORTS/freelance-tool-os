import type { NextConfig } from "next";
import { CHIAVE_PUBBLICA } from "./src/lib/licenza/chiave-pubblica";
import { controlloChiavePubblica } from "./src/lib/licenza/presidio";

/**
 * Nessun build di produzione senza una chiave pubblica vera.
 *
 * Qui e non in uno script `prebuild`: questo file lo legge ogni `next build`,
 * comunque lo si invochi — `npm run build`, `next build` a mano, una pipeline
 * di CI — mentre un `prebuild` si salta scavalcando npm. `next dev` lascia
 * passare il segnaposto, che in sviluppo è il comportamento voluto.
 */
const problema = controlloChiavePubblica(CHIAVE_PUBBLICA, process.env.NODE_ENV);
if (problema) throw new Error(problema);

const nextConfig: NextConfig = {
  /**
   * Export statico: nessun runtime server, nessun dato che lasci il browser.
   * È la scelta che rende vero il «local-first» del progetto — l'app si apre da
   * qualunque hosting statico e continua a funzionare offline — e che permette
   * di consegnarla come licenza una tantum.
   * Da servire con un qualsiasi server statico: `npx serve out`.
   */
  output: "export",
  images: { unoptimized: true },
  /** Percorsi con lo slash finale: file system statici e hosting semplici li gradiscono. */
  trailingSlash: true,
};

export default nextConfig;
