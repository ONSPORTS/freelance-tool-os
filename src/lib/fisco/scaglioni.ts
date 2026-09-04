/**
 * L'imposta progressiva per scaglioni.
 *
 * Serve all'IRPEF e alle addizionali che molte regioni applicano allo stesso
 * modo. Sta in un modulo suo perché la usano due parti del calcolo che non
 * devono dipendere l'una dall'altra: la formula è una, e resta una.
 */
import { round2 } from "./aritmetica";
import type { ScaglioneIrpef } from "./tipi";

export function impostaProgressiva(
  imponibile: number,
  scaglioni: readonly ScaglioneIrpef[],
): number {
  if (imponibile <= 0) return 0;
  let imposta = 0;
  let precedente = 0;
  for (const s of scaglioni) {
    const tetto = s.limite ?? Number.POSITIVE_INFINITY;
    const quota = Math.min(imponibile, tetto) - precedente;
    if (quota <= 0) break;
    imposta += quota * s.aliquota;
    precedente = tetto;
    if (imponibile <= tetto) break;
  }
  return round2(imposta);
}
