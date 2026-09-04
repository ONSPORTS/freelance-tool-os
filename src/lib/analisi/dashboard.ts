/**
 * Gli aggregati che il cruscotto legge. Funzioni pure sui documenti già
 * calcolati: nessun accesso all'archivio, nessuna data implicita.
 */
import { rapporto, round2, somma } from "@/lib/fisco/aritmetica";
import { annoDi, meseDi } from "@/lib/fisco/documenti";
import type { CostoCalcolato, FatturaCalcolata } from "@/lib/fisco/tipi";
import type { Cliente } from "@/lib/dati/tipi";

export type MeseAndamento = {
  mese: number;
  etichetta: string;
  emesso: number;
  incassato: number;
  costi: number;
  /** Incassato al netto dei costi pagati, cumulato da gennaio. */
  cumulatoIncassato: number;
};

export type RigaCliente = {
  id: string;
  nome: string;
  colore: string;
  emesso: number;
  incassato: number;
  daIncassare: number;
  scaduto: number;
  numeroFatture: number;
  ticketMedio: number;
  giorniMediIncasso: number | null;
  quota: number;
};

export type FasceScaduto = {
  neiTermini: number;
  entro30: number;
  entro60: number;
  entro90: number;
  oltre90: number;
  totaleScaduto: number;
};

const MESI_BREVI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

/** Dodici mesi, sempre tutti: un grafico con i buchi è illeggibile. */
export function andamentoMensile(
  fatture: FatturaCalcolata[],
  costi: CostoCalcolato[],
  anno: number,
): MeseAndamento[] {
  const righe: MeseAndamento[] = [];
  let cumulato = 0;
  for (let m = 1; m <= 12; m++) {
    // `ricavoRilevante` da tutt'e due le parti — imponibile più rivalsa — e non
    // l'imponibile di qua e il ricavo di là: le due colonne stanno sullo stesso
    // asse e si confrontano a vista, e con la rivalsa attiva la stessa fattura
    // ne disegnava due di altezza diversa. Quella differenza si legge come un
    // incasso mancante, che è il modo peggiore di sbagliare un grafico.
    const emesso = somma(
      ...fatture
        .filter((f) => annoDi(f.dataEmissione) === anno && meseDi(f.dataEmissione) === m)
        .map((f) => f.ricavoRilevante),
    );
    const incassato = somma(
      ...fatture
        .filter((f) => f.dataIncasso && annoDi(f.dataIncasso) === anno && meseDi(f.dataIncasso) === m)
        .map((f) => f.ricavoRilevante),
    );
    const costiMese = somma(
      ...costi
        .filter((c) => c.dataPagamento && annoDi(c.dataPagamento) === anno && meseDi(c.dataPagamento) === m)
        .map((c) => c.costoNetto),
    );
    cumulato = round2(cumulato + incassato - costiMese);
    righe.push({
      mese: m,
      etichetta: MESI_BREVI[m - 1],
      emesso,
      incassato,
      costi: costiMese,
      cumulatoIncassato: cumulato,
    });
  }
  return righe;
}

/** Il portafoglio clienti, dal più grande al più piccolo. */
export function portafoglioClienti(
  fatture: FatturaCalcolata[],
  clienti: Cliente[],
  anno: number,
  coloreDi: (nome: string) => string,
): RigaCliente[] {
  const emesseNellAnno = fatture.filter((f) => annoDi(f.dataEmissione) === anno);
  const totale = somma(...emesseNellAnno.map((f) => f.imponibile));

  const righe = clienti.map((cliente): RigaCliente => {
    const sue = emesseNellAnno.filter((f) => f.clienteId === cliente.id);
    const emesso = somma(...sue.map((f) => f.imponibile));
    const incassate = fatture.filter(
      (f) => f.clienteId === cliente.id && f.dataIncasso && annoDi(f.dataIncasso) === anno,
    );
    const aperte = fatture.filter((f) => f.clienteId === cliente.id && !f.dataIncasso);
    const giorni = incassate
      .map((f) => f.giorniIncasso)
      .filter((g): g is number => g !== null);

    return {
      id: cliente.id,
      nome: cliente.nome,
      colore: coloreDi(cliente.nome),
      emesso,
      incassato: somma(...incassate.map((f) => f.nettoIncasso)),
      daIncassare: somma(...aperte.map((f) => f.nettoIncasso)),
      scaduto: somma(...aperte.filter((f) => f.giorniRitardo > 0).map((f) => f.nettoIncasso)),
      numeroFatture: sue.length,
      ticketMedio: sue.length > 0 ? round2(emesso / sue.length) : 0,
      giorniMediIncasso:
        giorni.length > 0 ? Math.round(giorni.reduce((a, g) => a + g, 0) / giorni.length) : null,
      quota: rapporto(emesso, totale),
    };
  });

  return righe.filter((r) => r.numeroFatture > 0 || r.daIncassare > 0)
    .sort((a, b) => b.emesso - a.emesso);
}

/**
 * Lo scaduto per fascia di ritardo. La concentrazione del credito nelle fasce
 * lunghe è il segnale che una fattura non rientrerà da sola.
 */
export function scadutoPerFascia(fatture: FatturaCalcolata[]): FasceScaduto {
  const aperte = fatture.filter((f) => !f.dataIncasso);
  const inFascia = (da: number, a: number) =>
    somma(
      ...aperte.filter((f) => f.giorniRitardo >= da && f.giorniRitardo <= a).map((f) => f.nettoIncasso),
    );
  const neiTermini = somma(...aperte.filter((f) => f.giorniRitardo === 0).map((f) => f.nettoIncasso));
  const entro30 = inFascia(1, 30);
  const entro60 = inFascia(31, 60);
  const entro90 = inFascia(61, 90);
  const oltre90 = somma(...aperte.filter((f) => f.giorniRitardo > 90).map((f) => f.nettoIncasso));
  return {
    neiTermini,
    entro30,
    entro60,
    entro90,
    oltre90,
    totaleScaduto: somma(entro30, entro60, entro90, oltre90),
  };
}

/** Giorni medi fra emissione e accredito, sulle fatture già incassate. */
export function giorniMediIncasso(fatture: FatturaCalcolata[]): number | null {
  const giorni = fatture.map((f) => f.giorniIncasso).filter((g): g is number => g !== null);
  if (giorni.length === 0) return null;
  return Math.round(giorni.reduce((a, g) => a + g, 0) / giorni.length);
}

/**
 * Quanto pesa il cliente più grande. Sopra il 40% una disdetta dimezza l'anno:
 * è il rischio numero uno di chi lavora da solo.
 */
export function concentrazione(portafoglio: RigaCliente[]): number {
  return portafoglio[0]?.quota ?? 0;
}
