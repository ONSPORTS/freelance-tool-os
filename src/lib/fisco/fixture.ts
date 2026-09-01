/**
 * I due scenari verificati a mano sull'Excel di partenza.
 * Se il motore non li riproduce al centesimo, è sbagliato il motore.
 * Vivono fuori dal file di test perché servono anche al dataset dimostrativo.
 */
import { impostazioniPredefinite } from "./impostazioni";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Costo, Fattura, Impostazioni } from "./tipi";

export const OGGI_FIXTURE = "2026-09-01";

/** 7.500 € incassati su 10.000 € emessi, tre clienti. */
export const FATTURE_FIXTURE: Fattura[] = [
  {
    id: "f1",
    dataEmissione: "2026-01-15",
    numero: "2026/001",
    clienteId: "alfa",
    descrizione: "Consulenza marketing gennaio",
    tipoRicavo: "ricorrente",
    imponibile: 3000,
    dataIncasso: "2026-02-10",
  },
  {
    id: "f2",
    dataEmissione: "2026-02-03",
    numero: "2026/002",
    clienteId: "beta",
    descrizione: "Progetto posizionamento",
    tipoRicavo: "progetto",
    imponibile: 4500,
    dataIncasso: "2026-03-05",
  },
  {
    id: "f3",
    dataEmissione: "2026-03-20",
    numero: "2026/003",
    clienteId: "gamma",
    descrizione: "Retainer trimestrale",
    tipoRicavo: "ricorrente",
    imponibile: 2500,
    dataIncasso: null,
  },
];

/** 980 € di imponibile, 1.019,60 € di uscita di cassa, 39,60 € di IVA. */
export const COSTI_FIXTURE: Costo[] = [
  {
    id: "c1",
    dataDocumento: "2026-01-08",
    fornitore: "Adobe",
    categoria: "Software e abbonamenti",
    descrizione: "Creative Cloud",
    natura: "fisso",
    imponibile: 60,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-01-08",
  },
  {
    id: "c2",
    dataDocumento: "2026-01-31",
    fornitore: "Studio Rossi",
    categoria: "Commercialista e consulenze",
    descrizione: "Onorario mensile",
    natura: "fisso",
    imponibile: 120,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-02-05",
  },
  {
    id: "c3",
    dataDocumento: "2026-02-12",
    fornitore: "Meta Platforms",
    categoria: "Pubblicità e advertising",
    descrizione: "Campagna lead gen",
    natura: "variabile",
    imponibile: 800,
    aliquotaIva: 0,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-02-12",
  },
];

export function impostazioniForfettario(): Impostazioni {
  return {
    ...impostazioniPredefinite(PARAMETRI_2026),
    regime: "forfettario",
    coefficienteRedditivita: 0.78,
    gestione: "separata",
  };
}

export function impostazioniOrdinario(): Impostazioni {
  return {
    ...impostazioniPredefinite(PARAMETRI_2026),
    regime: "ordinario",
    gestione: "separata",
    addizionaleRegionale: 0.0173,
    addizionaleComunale: 0.008,
  };
}
