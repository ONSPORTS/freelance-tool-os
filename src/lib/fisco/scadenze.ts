/**
 * Lo scadenzario fiscale dell'anno, con gli importi collegati ai numeri reali.
 *
 * Le voci si filtrano da sole in base al regime e alla gestione previdenziale:
 * chi è in forfettario non deve vedere la LIPE, chi è in Gestione Separata non
 * deve vedere le rate dei contributi fissi degli artigiani.
 *
 * Le date che cadono di sabato, domenica o in un festivo slittano al primo
 * giorno lavorativo successivo.
 */
import { slittaAGiornoLavorativo } from "./calendario";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

export type Adempimento = {
  id: string;
  /** Data effettiva di versamento, già spostata se cadeva in un festivo. */
  data: string;
  /** Data di calendario prima dello slittamento, quando differisce. */
  dataDiCalendario?: string;
  titolo: string;
  /** Importo stimato, `null` quando l'adempimento è solo dichiarativo. */
  importo: number | null;
  categoria: "iva" | "imposte" | "contributi" | "dichiarazione" | "bollo";
};

type Voce = Omit<Adempimento, "data" | "dataDiCalendario"> & {
  mese: number;
  giorno: number;
  /** Anno successivo a quello di riferimento. */
  annoDopo?: boolean;
  quando: (ctx: Contesto) => boolean;
};

type Contesto = {
  imp: Impostazioni;
  forfettario: boolean;
  mensile: boolean;
  artigiani: boolean;
};

export function scadenzeAnno(
  imp: Impostazioni,
  par: ParametriAnno,
  prospetto: Prospetto,
  iva: LiquidazioneIva,
): Adempimento[] {
  const ctx: Contesto = {
    imp,
    forfettario: imp.regime === "forfettario",
    mensile: imp.periodicitaIva === "mensile",
    artigiani: imp.gestione === "artigiani",
  };

  const rataArtigiani = imp.contributiFissi / 4;
  const trimestre = (indice: number) => iva.trimestri[indice]?.totaleDaVersare ?? 0;
  const mese = (indice: number) => iva.mesi[indice]?.totaleDaVersare ?? 0;

  const voci: Voce[] = [
    {
      id: "iva-dicembre-precedente", mese: 2, giorno: 16, categoria: "iva",
      titolo: "IVA di dicembre e saldo del 4° trimestre dell'anno precedente",
      importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "inps-artigiani-1", mese: 2, giorno: 16, categoria: "contributi",
      titolo: "Contributi fissi INPS artigiani e commercianti — 1ª rata",
      importo: rataArtigiani, quando: (c) => c.artigiani,
    },
    {
      id: "bollo-4t-precedente", mese: 3, giorno: 16, categoria: "bollo",
      titolo: "Imposta di bollo sulle fatture del 4° trimestre precedente",
      importo: null, quando: (c) => c.forfettario,
    },
    {
      id: "lipe-4t-precedente", mese: 3, giorno: 31, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni periodiche del 4° trimestre precedente",
      importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "dichiarazione-iva", mese: 4, giorno: 30, categoria: "dichiarazione",
      titolo: "Dichiarazione IVA annuale", importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "iva-1t", mese: 5, giorno: 16, categoria: "iva",
      titolo: "IVA del 1° trimestre", importo: trimestre(0),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "inps-artigiani-2", mese: 5, giorno: 16, categoria: "contributi",
      titolo: "Contributi fissi INPS artigiani e commercianti — 2ª rata",
      importo: rataArtigiani, quando: (c) => c.artigiani,
    },
    {
      id: "lipe-1t", mese: 5, giorno: 31, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 1° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "saldo-e-primo-acconto", mese: 6, giorno: 30, categoria: "imposte",
      titolo: "Saldo di imposte e contributi più il primo acconto",
      importo: prospetto.saldoResiduo + prospetto.acconti.primo,
      quando: () => true,
    },
    {
      id: "rinvio-luglio", mese: 7, giorno: 31, categoria: "imposte",
      titolo: "Versamento differito con maggiorazione dello 0,40%",
      importo: null, quando: () => true,
    },
    {
      id: "iva-2t", mese: 8, giorno: 20, categoria: "iva",
      titolo: "IVA del 2° trimestre", importo: trimestre(1),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "inps-artigiani-3", mese: 8, giorno: 20, categoria: "contributi",
      titolo: "Contributi fissi INPS artigiani e commercianti — 3ª rata",
      importo: rataArtigiani, quando: (c) => c.artigiani,
    },
    {
      id: "lipe-2t", mese: 9, giorno: 30, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 2° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "redditi-pf", mese: 10, giorno: 31, categoria: "dichiarazione",
      titolo: "Dichiarazione dei redditi — Modello Redditi PF",
      importo: null, quando: () => true,
    },
    {
      id: "iva-3t", mese: 11, giorno: 16, categoria: "iva",
      titolo: "IVA del 3° trimestre", importo: trimestre(2),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "inps-artigiani-4", mese: 11, giorno: 16, categoria: "contributi",
      titolo: "Contributi fissi INPS artigiani e commercianti — 4ª rata",
      importo: rataArtigiani, quando: (c) => c.artigiani,
    },
    {
      id: "secondo-acconto", mese: 11, giorno: 30, categoria: "imposte",
      titolo: prospetto.acconti.accontoUnico
        ? "Acconto unico di imposte e contributi"
        : "Secondo acconto di imposte e contributi",
      importo: prospetto.acconti.secondo,
      quando: () => prospetto.acconti.dovuti,
    },
    {
      id: "lipe-3t", mese: 11, giorno: 30, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 3° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "acconto-iva", mese: 12, giorno: 27, categoria: "iva",
      titolo: "Acconto IVA annuale", importo: null, quando: (c) => !c.forfettario,
    },
  ];

  // Liquidazioni mensili: una per ciascun mese, il 16 del mese successivo.
  if (!ctx.forfettario && ctx.mensile) {
    for (let m = 0; m < 12; m++) {
      voci.push({
        id: `iva-mensile-${m + 1}`,
        mese: m === 11 ? 1 : m + 2,
        giorno: 16,
        annoDopo: m === 11,
        categoria: "iva",
        titolo: `IVA di ${NOMI_MESI[m]}`,
        importo: mese(m),
        quando: () => true,
      });
    }
  }

  return voci
    .filter((v) => v.quando(ctx))
    .map((v) => {
      const anno = imp.anno + (v.annoDopo ? 1 : 0);
      const dataDiCalendario = `${anno}-${String(v.mese).padStart(2, "0")}-${String(v.giorno).padStart(2, "0")}`;
      const data = slittaAGiornoLavorativo(dataDiCalendario);
      return {
        id: v.id,
        data,
        ...(data === dataDiCalendario ? {} : { dataDiCalendario }),
        titolo: v.titolo,
        importo: v.importo,
        categoria: v.categoria,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

/** Le prossime scadenze a partire dalla data indicata. */
export function prossimeScadenze(
  scadenze: Adempimento[],
  oggiIso: string,
  quante = 4,
): Adempimento[] {
  return scadenze.filter((s) => s.data >= oggiIso).slice(0, quante);
}

const NOMI_MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
