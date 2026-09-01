import type { NextConfig } from "next";

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
