export type Verso = "crescente" | "decrescente";

export type Ordinamento<C extends string> = { colonna: C; verso: Verso };

/** Il clic successivo sulla stessa colonna inverte il verso. */
export function prossimoOrdinamento<C extends string>(
  attuale: Ordinamento<C>,
  colonna: C,
  versoIniziale: Verso = "crescente",
): Ordinamento<C> {
  if (attuale.colonna !== colonna) return { colonna, verso: versoIniziale };
  return { colonna, verso: attuale.verso === "crescente" ? "decrescente" : "crescente" };
}

/**
 * Ordina per la chiave estratta. I valori assenti finiscono sempre in fondo,
 * in entrambi i versi: una fattura senza data di incasso non deve scalare in
 * cima solo perché si è invertito l'ordine.
 */
export function ordinaPer<T>(
  righe: T[],
  chiave: (riga: T) => string | number | null | undefined,
  verso: Verso,
): T[] {
  const segno = verso === "crescente" ? 1 : -1;
  return [...righe].sort((a, b) => {
    const va = chiave(a);
    const vb = chiave(b);
    const aVuoto = va === null || va === undefined || va === "";
    const bVuoto = vb === null || vb === undefined || vb === "";
    if (aVuoto && bVuoto) return 0;
    if (aVuoto) return 1;
    if (bVuoto) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * segno;
    return String(va).localeCompare(String(vb), "it") * segno;
  });
}
