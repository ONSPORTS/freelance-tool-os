/**
 * Fatture e costi in un CSV che Excel italiano apre senza chiedere niente.
 *
 * Serve a due cose: rifare il giro inverso — esportare, correggere nel foglio,
 * reimportare — e dare al commercialista un file che sa aprire, che è ancora
 * il modo più diffuso di scambiarsi dei numeri.
 *
 * Perciò: separatore `;`, virgola decimale, date `gg/mm/aaaa`, e il BOM in
 * testa. Senza BOM, Excel su Windows legge il file come Latin-1 e «società»
 * diventa «societÃ ». Le date passano dai formatter di `format.ts`, gli importi
 * no: qui servono cifre grezze con la virgola, senza il simbolo dell'euro e
 * senza separatore di migliaia, perché il foglio li deve riconoscere come
 * numeri e non come testo.
 */
import { data as fmtData } from "@/lib/format";
import type { Cliente, Costo, Fattura } from "@/lib/dati/tipi";

export const SEPARATORE = ";";
const BOM = "﻿";

/** Un numero come lo vuole Excel italiano: `1234,50`, mai `1.234,50 €`. */
export function numeroCsv(valore: number): string {
  return valore.toFixed(2).replace(".", ",");
}

/** Racchiude fra virgolette solo quando serve, e raddoppia quelle interne. */
export function cella(valore: string | number | null | undefined): string {
  const testo = valore === null || valore === undefined ? "" : String(valore);
  return /[";\n\r]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

export function componiCsv(intestazioni: string[], righe: (string | number | null)[][]): string {
  const linee = [intestazioni, ...righe].map((r) => r.map(cella).join(SEPARATORE));
  // `\r\n`: è quello che Excel si aspetta, e i lettori Unix lo tollerano.
  return BOM + linee.join("\r\n") + "\r\n";
}

export function fattureCsv(fatture: Fattura[], clienti: Cliente[]): string {
  const nome = (id: string) => clienti.find((c) => c.id === id)?.nome ?? "";
  const ordinate = [...fatture].sort((a, b) => a.dataEmissione.localeCompare(b.dataEmissione));
  return componiCsv(
    [
      "Data emissione",
      "Numero",
      "Cliente",
      "Descrizione",
      "Tipo ricavo",
      "Imponibile",
      "Aliquota IVA",
      "Data incasso",
    ],
    ordinate.map((f) => [
      fmtData(f.dataEmissione),
      f.numero,
      nome(f.clienteId),
      f.descrizione,
      f.tipoRicavo,
      numeroCsv(f.imponibile),
      numeroCsv((f.aliquotaIva ?? 0) * 100),
      f.dataIncasso ? fmtData(f.dataIncasso) : "",
    ]),
  );
}

export function costiCsv(costi: Costo[]): string {
  const ordinati = [...costi].sort((a, b) => a.dataDocumento.localeCompare(b.dataDocumento));
  return componiCsv(
    [
      "Data documento",
      "Fornitore",
      "Categoria",
      "Descrizione",
      "Natura",
      "Imponibile",
      "Aliquota IVA",
      "Deducibilità",
      "Data pagamento",
    ],
    ordinati.map((c) => [
      fmtData(c.dataDocumento),
      c.fornitore,
      c.categoria,
      c.descrizione,
      c.natura,
      numeroCsv(c.imponibile),
      numeroCsv(c.aliquotaIva * 100),
      numeroCsv(c.percentualeDeducibilita * 100),
      c.dataPagamento ? fmtData(c.dataPagamento) : "",
    ]),
  );
}

export function nomeFileCsv(cosa: "fatture" | "costi", anno: number): string {
  return `flowlance-${cosa}-${anno}.csv`;
}
