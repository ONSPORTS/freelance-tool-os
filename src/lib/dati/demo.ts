/**
 * Dataset dimostrativo: un anno plausibile di un consulente che fattura
 * circa 46.000 €, con un retainer che regge il fatturato, qualche progetto,
 * un cliente che paga in ritardo e i costi che un professionista ha davvero.
 *
 * Serve a tre cose: far vedere l'app piena a chi la apre per la prima volta,
 * dare qualcosa su cui provare filtri e grafici, e tenere onesti i calcoli su
 * un anno intero invece che sui tre documenti dei casi di prova.
 *
 * È deterministico: nessun numero casuale, così due esecuzioni producono lo
 * stesso file di backup e i test possono affermare qualcosa di preciso.
 *
 * Rappresenta un anno solare completo, così ogni grafico e ogni tabella hanno
 * dodici mesi da mostrare. Quattro fatture restano aperte per 6.100 €, di cui
 * una scaduta da mesi: il credito commerciale è una delle cose che l'app deve
 * far vedere subito.
 */
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type {
  Cliente,
  Costo,
  Dati,
  Fattura,
  MovimentoAttivita,
  MovimentoPersonale,
  VersamentoF24,
  VocePatrimonio,
} from "./tipi";

export const ANNO_DEMO = 2026;

function iso(mese: number, giorno: number, anno = ANNO_DEMO): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

const CLIENTI: Cliente[] = [
  {
    id: "cli-alfa",
    nome: "Alfa Srl",
    canaleAcquisizione: "Passaparola",
    note: "Retainer mensile dal 2024. Pagano puntuali, referente Silvia.",
  },
  {
    id: "cli-beta",
    nome: "Beta Spa",
    canaleAcquisizione: "LinkedIn",
    note: "Progetti a lotti. Fatturare sempre con ordine di acquisto.",
  },
  {
    id: "cli-gamma",
    nome: "Gamma Snc",
    canaleAcquisizione: "Passaparola",
    note: "Retainer trimestrale, rinnovo da concordare a dicembre.",
  },
  {
    id: "cli-delta",
    nome: "Delta Studio",
    canaleAcquisizione: "Rete professionale",
    note: "Collaborazione in subappalto. Pagano a 60 giorni reali.",
  },
  {
    id: "cli-epsilon",
    nome: "Consorzio Epsilon",
    canaleAcquisizione: "Bando",
    note: "Formazione finanziata: tempi di incasso lunghi ma certi.",
  },
  {
    id: "cli-zeta",
    nome: "Zeta Digital",
    canaleAcquisizione: "Sito web",
    note: "Cliente piccolo e lento. Valutare acconto alla firma.",
  },
  {
    id: "cli-bianchi",
    nome: "Marco Bianchi",
    canaleAcquisizione: "Sito web",
    note: "Privato, consulenza una tantum.",
  },
];

type SemeFattura = {
  mese: number;
  giorno: number;
  cliente: string;
  descrizione: string;
  tipo: Fattura["tipoRicavo"];
  imponibile: number;
  /** Giorni fra emissione e incasso. `null` se non ancora incassata. */
  incassoDopo: number | null;
};

const SEMI_FATTURE: SemeFattura[] = [
  // Alfa Srl — il retainer che regge l'anno.
  ...Array.from({ length: 12 }, (_, i): SemeFattura => ({
    mese: i + 1,
    giorno: 5,
    cliente: "cli-alfa",
    descrizione: `Consulenza strategica — ${["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"][i]}`,
    tipo: "ricorrente",
    imponibile: 1500,
    // Il retainer rientra sempre, con qualche giorno di oscillazione.
    // Solo l'ultima dell'anno resta ancora aperta.
    incassoDopo: i === 11 ? null : [28, 31, 26, 30, 27, 33, 25, 29, 30, 26, 32][i],
  })),
  // Gamma Snc — retainer trimestrale.
  { mese: 1, giorno: 20, cliente: "cli-gamma", descrizione: "Retainer 1° trimestre", tipo: "ricorrente", imponibile: 1800, incassoDopo: 35 },
  { mese: 4, giorno: 20, cliente: "cli-gamma", descrizione: "Retainer 2° trimestre", tipo: "ricorrente", imponibile: 1800, incassoDopo: 33 },
  { mese: 7, giorno: 20, cliente: "cli-gamma", descrizione: "Retainer 3° trimestre", tipo: "ricorrente", imponibile: 1800, incassoDopo: 30 },
  { mese: 10, giorno: 20, cliente: "cli-gamma", descrizione: "Retainer 4° trimestre", tipo: "ricorrente", imponibile: 1800, incassoDopo: null },
  // Beta Spa — progetti.
  { mese: 3, giorno: 12, cliente: "cli-beta", descrizione: "Riposizionamento di marca — fase 1", tipo: "progetto", imponibile: 6500, incassoDopo: 41 },
  { mese: 9, giorno: 8, cliente: "cli-beta", descrizione: "Riposizionamento di marca — fase 2", tipo: "progetto", imponibile: 4200, incassoDopo: 46 },
  // Delta Studio — subappalto, pagano tardi.
  { mese: 5, giorno: 15, cliente: "cli-delta", descrizione: "Analisi di mercato in subappalto", tipo: "progetto", imponibile: 2400, incassoDopo: 62 },
  { mese: 11, giorno: 10, cliente: "cli-delta", descrizione: "Aggiornamento analisi di mercato", tipo: "progetto", imponibile: 1900, incassoDopo: null },
  // Consorzio Epsilon — formazione finanziata.
  { mese: 6, giorno: 3, cliente: "cli-epsilon", descrizione: "Percorso formativo — 24 ore d'aula", tipo: "progetto", imponibile: 3200, incassoDopo: 74 },
  // Zeta Digital — la fattura che va sollecitata.
  { mese: 2, giorno: 18, cliente: "cli-zeta", descrizione: "Audit dei contenuti", tipo: "unaTantum", imponibile: 1100, incassoDopo: 52 },
  { mese: 6, giorno: 24, cliente: "cli-zeta", descrizione: "Revisione piano editoriale", tipo: "unaTantum", imponibile: 900, incassoDopo: null },
  // Privato.
  { mese: 7, giorno: 9, cliente: "cli-bianchi", descrizione: "Consulenza individuale", tipo: "unaTantum", imponibile: 650, incassoDopo: 12 },
];

function costruisciFatture(): Fattura[] {
  const ordinate = [...SEMI_FATTURE].sort(
    (a, b) => a.mese - b.mese || a.giorno - b.giorno || a.cliente.localeCompare(b.cliente),
  );
  return ordinate.map((seme, indice) => {
    const dataEmissione = iso(seme.mese, seme.giorno);
    const dataIncasso =
      seme.incassoDopo === null
        ? null
        : new Date(Date.parse(`${dataEmissione}T00:00:00Z`) + seme.incassoDopo * 86_400_000)
            .toISOString()
            .slice(0, 10);
    return {
      id: `fat-${String(indice + 1).padStart(3, "0")}`,
      dataEmissione,
      numero: `${ANNO_DEMO}/${String(indice + 1).padStart(3, "0")}`,
      clienteId: seme.cliente,
      descrizione: seme.descrizione,
      tipoRicavo: seme.tipo,
      imponibile: seme.imponibile,
      dataIncasso,
    };
  });
}

type SemeCosto = Omit<Costo, "id" | "dataDocumento" | "dataPagamento"> & {
  mese: number;
  giorno: number;
  /** Giorni fra documento e pagamento. `null` se ancora da pagare. */
  pagatoDopo: number | null;
};

/** Un costo che si ripete ogni mese, come un abbonamento o un affitto. */
function ricorrente(
  base: Omit<SemeCosto, "mese" | "giorno" | "pagatoDopo">,
  giorno: number,
  pagatoDopo = 0,
  mesi = 12,
): SemeCosto[] {
  return Array.from({ length: mesi }, (_, i) => ({
    ...base,
    mese: i + 1,
    giorno,
    pagatoDopo,
  }));
}

const SEMI_COSTI: SemeCosto[] = [
  ...ricorrente(
    {
      fornitore: "Studio Rossi",
      categoria: "Commercialista e consulenze",
      descrizione: "Onorario mensile",
      natura: "fisso",
      imponibile: 120,
      aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
      percentualeDetraibilitaIva: 1,
    },
    28,
    5,
  ),
  ...ricorrente(
    {
      fornitore: "Spazio Comune",
      categoria: "Affitto e utenze ufficio",
      descrizione: "Postazione in coworking",
      natura: "fisso",
      imponibile: 150,
      aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
      percentualeDetraibilitaIva: 1,
    },
    3,
    0,
  ),
  ...ricorrente(
    {
      fornitore: "Adobe",
      categoria: "Software e abbonamenti",
      descrizione: "Creative Cloud",
      natura: "fisso",
      imponibile: 60,
      aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
      percentualeDetraibilitaIva: 1,
    },
    8,
    0,
  ),
  ...ricorrente(
    {
      fornitore: "Operatore Telefonico",
      categoria: "Telefonia e connettività",
      descrizione: "Linea mobile e fibra",
      natura: "fisso",
      imponibile: 35,
      aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
      // Telefonia a uso promiscuo: l'IVA si detrae al 50%.
      percentualeDetraibilitaIva: 0.5,
    },
    12,
    0,
  ),
  ...ricorrente(
    {
      fornitore: "Banca",
      categoria: "Banca e commissioni",
      descrizione: "Canone conto e commissioni",
      natura: "fisso",
      imponibile: 8,
      aliquotaIva: 0,
      percentualeDeducibilita: 1,
      percentualeDetraibilitaIva: 1,
    },
    1,
    0,
  ),
  {
    mese: 1, giorno: 22, pagatoDopo: 0,
    fornitore: "Assicurazioni Generali", categoria: "Assicurazioni",
    descrizione: "Polizza responsabilità professionale", natura: "fisso",
    imponibile: 320, aliquotaIva: 0, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 2, giorno: 14, pagatoDopo: 0,
    fornitore: "Meta Platforms", categoria: "Pubblicità e advertising",
    descrizione: "Campagna acquisizione contatti", natura: "variabile",
    imponibile: 800, aliquotaIva: 0, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 3, giorno: 6, pagatoDopo: 0,
    fornitore: "Scuola di Formazione", categoria: "Formazione",
    descrizione: "Corso di analisi dei dati", natura: "variabile",
    imponibile: 490, aliquotaIva: 0.22, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 4, giorno: 17, pagatoDopo: 0,
    fornitore: "Trenitalia", categoria: "Viaggi e trasferte",
    descrizione: "Trasferte cliente Beta", natura: "variabile",
    imponibile: 380, aliquotaIva: 0.1, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 6, giorno: 11, pagatoDopo: 0,
    fornitore: "Google Ireland", categoria: "Pubblicità e advertising",
    descrizione: "Campagna ricerca", natura: "variabile",
    imponibile: 600, aliquotaIva: 0, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 9, giorno: 2, pagatoDopo: 0,
    fornitore: "Rivenditore Hardware", categoria: "Attrezzature e hardware",
    descrizione: "Portatile di lavoro", natura: "variabile",
    imponibile: 1450, aliquotaIva: 0.22, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 10, giorno: 9, pagatoDopo: 0,
    fornitore: "Meta Platforms", categoria: "Pubblicità e advertising",
    descrizione: "Campagna autunnale", natura: "variabile",
    imponibile: 700, aliquotaIva: 0, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 10, giorno: 21, pagatoDopo: 0,
    fornitore: "Ristorante Da Piero", categoria: "Rappresentanza e ristoranti",
    descrizione: "Pranzo di lavoro con Delta", natura: "variabile",
    // Ristoranti: deducibile al 75%, IVA detraibile solo con fattura.
    imponibile: 260, aliquotaIva: 0.1, percentualeDeducibilita: 0.75, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 11, giorno: 28, pagatoDopo: null,
    fornitore: "Tipografia Moderna", categoria: "Marketing e contenuti",
    descrizione: "Stampa materiali per evento", natura: "variabile",
    imponibile: 340, aliquotaIva: 0.22, percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
];

function costruisciCosti(): Costo[] {
  const ordinati = [...SEMI_COSTI].sort(
    (a, b) => a.mese - b.mese || a.giorno - b.giorno || a.fornitore.localeCompare(b.fornitore),
  );
  return ordinati.map((seme, indice) => {
    const dataDocumento = iso(seme.mese, seme.giorno);
    const dataPagamento =
      seme.pagatoDopo === null
        ? null
        : new Date(Date.parse(`${dataDocumento}T00:00:00Z`) + seme.pagatoDopo * 86_400_000)
            .toISOString()
            .slice(0, 10);
    return {
      id: `cos-${String(indice + 1).padStart(3, "0")}`,
      dataDocumento,
      fornitore: seme.fornitore,
      categoria: seme.categoria,
      descrizione: seme.descrizione,
      natura: seme.natura,
      imponibile: seme.imponibile,
      aliquotaIva: seme.aliquotaIva,
      percentualeDeducibilita: seme.percentualeDeducibilita,
      percentualeDetraibilitaIva: seme.percentualeDetraibilitaIva,
      dataPagamento,
    };
  });
}

/**
 * Prelievi e spese personali, con l'estate più cara e dicembre pure.
 *
 * I 1.500 € al mese di prelievo non sono un numero tondo scelto a caso: è
 * quanto la cassa dell'attività regge davvero nel 2026, perché sopra i costi
 * correnti gravano 8.750 € di F24 dell'anno precedente. Con 1.700 € la
 * liquidità netta andrebbe sotto zero in autunno — e un dataset dimostrativo
 * che chiude l'anno in rosso somiglia a un errore di calcolo.
 */
function costruisciMovimentiPersonali(): MovimentoPersonale[] {
  const variabiliPerMese = [450, 420, 460, 500, 500, 560, 700, 650, 480, 460, 500, 750];
  return variabiliPerMese.map((variabili, i) => ({
    id: `mp-${ANNO_DEMO}-${String(i + 1).padStart(2, "0")}`,
    anno: ANNO_DEMO,
    mese: i + 1,
    prelievi: 1500,
    altreEntrate: 0,
    speseFisse: 900,
    speseVariabili: variabili,
    risparmio: 80,
  }));
}

function costruisciMovimentiAttivita(): MovimentoAttivita[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `ma-${ANNO_DEMO}-${String(i + 1).padStart(2, "0")}`,
    anno: ANNO_DEMO,
    mese: i + 1,
    altreEntrate: i === 3 ? 180 : 0, // rimborso spese di trasferta
    altreUscite: 0,
  }));
}

/** F24 dell'anno: saldo e primo acconto a giugno, secondo acconto a novembre. */
const VERSAMENTI: VersamentoF24[] = [
  { id: "f24-01", data: iso(6, 30), tipo: "contributi", importo: 4180 },
  { id: "f24-02", data: iso(6, 30), tipo: "imposte", importo: 1290 },
  { id: "f24-03", data: iso(11, 30), tipo: "contributi", importo: 2510 },
  { id: "f24-04", data: iso(11, 30), tipo: "imposte", importo: 770 },
];

const PATRIMONIO: VocePatrimonio[] = [
  { id: "pat-01", tipo: "attivo", categoria: "Investimenti finanziari", descrizione: "Piano di accumulo ETF", valore: 8400 },
  { id: "pat-02", tipo: "attivo", categoria: "Fondo pensione", descrizione: "Fondo pensione aperto", valore: 4600 },
  { id: "pat-03", tipo: "attivo", categoria: "Beni strumentali", descrizione: "Portatile e attrezzatura ufficio", valore: 2100 },
  { id: "pat-04", tipo: "passivo", categoria: "Finanziamenti", descrizione: "Prestito attrezzature, debito residuo", valore: 3200 },
];

/** L'intero dataset dimostrativo, pronto da scrivere nell'archivio. */
export function datiDemo(): Dati {
  return {
    impostazioni: [
      {
        ...impostazioniPredefinite(PARAMETRI_2026),
        nome: "Studio di consulenza",
        dataAperturaPiva: "2021-03-01",
        saldoInizialeAttivita: 3200,
        saldoInizialePersonale: 1800,
        tariffaOraria: 80,
        nettoDesiderato: 40_000,
        costiFissiAnnui: 12_000,
      },
    ],
    clienti: CLIENTI,
    fatture: costruisciFatture(),
    // Una nota di credito nel dataset: serve a vedere subito com'è fatta la
    // schermata e come compare la voce separata nel prospetto e nell'IVA.
    note: [
      {
        id: "nc-01",
        dataDocumento: "2026-07-24",
        numero: "NC/2026/1",
        clienteId: "cli-gamma",
        descrizione: "Storno parziale retainer 3° trimestre, servizio non erogato",
        imponibile: 400,
        aliquotaIva: 0.22,
        dataRimborso: "2026-08-05",
        riconciliazioni: [{ fatturaId: "fat-016", imponibile: 400 }],
      },
    ],
    costi: costruisciCosti(),
    movimentiPersonali: costruisciMovimentiPersonali(),
    movimentiAttivita: costruisciMovimentiAttivita(),
    versamenti: VERSAMENTI,
    patrimonio: PATRIMONIO,
    // Il saldo di giugno e il secondo acconto risultano già versati: i due F24
    // sopra sono la prova, la spunta è la memoria di averlo fatto.
    spunte: [
      { id: `${ANNO_DEMO}:saldo-e-primo-acconto`, anno: ANNO_DEMO, idAdempimento: "saldo-e-primo-acconto", completatoIl: iso(6, 30) },
    ],
    // Nessun anno chiuso: il dataset dimostrativo mostra l'anno in corso, e la
    // chiusura è una cosa che si prova, non che si trova già fatta.
    chiusure: [],
    // Il dataset dimostrativo non finge di aver risposto alle domande: il
    // percorso resta da fare, ed è giusto che si veda.
    percorsi: [],
  };
}

/**
 * Il dataset dimostrativo, conservando quello che l'utente ha già deciso.
 *
 * Serve al primo avvio: chi ha appena risposto alle domande di configurazione
 * non deve vedersele cancellare per aver chiesto di guardare le schermate
 * popolate. Le impostazioni restano le sue, i documenti sono inventati.
 */
export function datiDemoConservando(
  attuali: Dati,
  conserva: { impostazioni: boolean; percorsi: boolean },
): Dati {
  const demo = datiDemo();
  return {
    ...demo,
    impostazioni: conserva.impostazioni && attuali.impostazioni.length > 0
      ? attuali.impostazioni
      : demo.impostazioni,
    percorsi: conserva.percorsi ? attuali.percorsi : demo.percorsi,
  };
}
