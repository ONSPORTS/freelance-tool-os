"use client";

import { useEffect, useState } from "react";

/**
 * Rende i figli solo dopo il montaggio nel browser.
 * L'archivio vive in IndexedDB: durante la generazione statica non esiste, e
 * non deve esistere nemmeno il tentativo di aprirlo.
 */
export function SoloClient({
  children,
  segnaposto = null,
}: {
  children: React.ReactNode;
  segnaposto?: React.ReactNode;
}) {
  const [montato, setMontato] = useState(false);
  useEffect(() => setMontato(true), []);
  return <>{montato ? children : segnaposto}</>;
}
