/**
 * Trovare il proprio gruppo ATECO partendo dal mestiere.
 *
 * I nove gruppi del forfettario sono descritti come li chiama la legge —
 * «Attività professionali, scientifiche, tecniche, sanitarie…» — e chi non ha
 * la visura sottomano non sa in quale cade. Un consulente marketing deve poter
 * scrivere «consulente» e trovare il suo 78 %, senza sapere che la legge lo
 * chiama così.
 *
 * L'elenco qui sotto non è una tabella ATECO: è un dizionario di mestieri come
 * la gente li nomina, mappato sui nove gruppi. Serve a far trovare la voce,
 * non a certificare un codice — quello resta scritto in visura, e la ricerca
 * lo dice quando non trova niente.
 */
import type { GruppoAteco } from "./tipi";

export type Sinonimo = {
  /** Il gruppo di destinazione, per `codice`. */
  gruppo: string;
  /** Come la gente chiama il mestiere. */
  parole: string[];
};

/**
 * I mestieri più comuni fra i freelance, per gruppo.
 *
 * Ordinati per frequenza dentro ciascun gruppo, non alfabeticamente: chi cerca
 * «grafico» deve trovare la voce giusta al primo colpo.
 */
export const SINONIMI: Sinonimo[] = [
  {
    gruppo: "professionali",
    parole: [
      "consulente", "consulenza", "marketing", "comunicazione", "social media manager",
      "copywriter", "content", "seo", "strategist", "grafico", "graphic designer",
      "designer", "ux", "ui", "web designer", "illustratore", "fotografo", "videomaker",
      "montatore", "sviluppatore", "programmatore", "developer", "informatico",
      "data scientist", "analista", "ingegnere", "architetto", "geometra", "avvocato",
      "commercialista", "consulente del lavoro", "notaio", "traduttore", "interprete",
      "giornalista", "insegnante", "formatore", "docente", "coach", "psicologo",
      "psicoterapeuta", "medico", "dentista", "fisioterapista", "logopedista",
      "nutrizionista", "dietista", "osteopata", "infermiere", "veterinario",
      "farmacista", "agente assicurativo", "promotore finanziario", "revisore",
      "perito", "agronomo", "biologo", "chimico", "ricercatore", "project manager",
    ],
  },
  {
    gruppo: "altre",
    parole: [
      "personal trainer", "istruttore", "estetista", "parrucchiere", "barbiere",
      "massaggiatore", "tatuatore", "wedding planner", "organizzatore eventi",
      "guida turistica", "animatore", "dj", "musicista", "artista", "attore",
      "ballerino", "autista", "corriere", "rider", "trasporti", "pulizie",
      "giardiniere", "dogsitter", "babysitter", "sarta", "riparazioni",
      "assistenza tecnica", "call center", "segreteria", "servizi",
    ],
  },
  {
    gruppo: "costruzioni",
    parole: [
      "edile", "muratore", "imbianchino", "idraulico", "elettricista",
      "impiantista", "termoidraulico", "cartongessista", "piastrellista",
      "falegname", "fabbro", "serramentista", "ristrutturazioni", "impresa edile",
      "agente immobiliare", "immobiliare", "geometra di cantiere", "posatore",
    ],
  },
  {
    gruppo: "intermediari",
    parole: [
      "agente di commercio", "rappresentante", "procacciatore", "mediatore",
      "intermediario", "broker", "segnalatore", "affiliate", "dropshipping senza magazzino",
    ],
  },
  {
    gruppo: "commercio",
    parole: [
      "negozio", "e-commerce", "ecommerce", "shop online", "vendita online",
      "commerciante", "rivenditore", "grossista", "ingrosso", "dettaglio",
      "abbigliamento", "libreria", "cartoleria", "ferramenta", "artigiano che rivende",
    ],
  },
  {
    gruppo: "ambulanteAlimentari",
    parole: ["ambulante alimentari", "mercato alimentare", "food truck", "banco alimentari"],
  },
  {
    gruppo: "ambulanteAltri",
    parole: ["ambulante", "mercatino", "banco al mercato", "fiere", "venditore ambulante"],
  },
  {
    gruppo: "alimentari",
    parole: [
      "panificio", "panettiere", "pasticceria", "pasticcere", "gelateria",
      "birrificio", "conserve", "produzione alimentare", "laboratorio alimentare",
    ],
  },
  {
    gruppo: "ristorazione",
    parole: [
      "ristorante", "ristoratore", "pizzeria", "pizzaiolo", "bar", "barista",
      "catering", "chef", "cuoco", "b&b", "affittacamere", "agriturismo",
      "albergo", "hotel", "street food",
    ],
  },
];

/** Minuscolo, senza accenti, senza punteggiatura: «E-commerce» e «ecommerce» sono la stessa parola. */
export function normalizza(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type EsitoAteco = {
  gruppo: GruppoAteco;
  /**
   * Perché è uscito: il mestiere che ha fatto centro, da mostrare accanto alla
   * voce. Senza questo la ricerca sembra magia e non si capisce se ha capito.
   */
  perche: string | null;
  punteggio: number;
};

/**
 * I gruppi che rispondono a una ricerca, dal più pertinente.
 *
 * Cerca prima nei mestieri, poi nella descrizione di legge: chi scrive
 * «ristorazione» trova comunque la voce anche se non è nel dizionario.
 */
export function cercaGruppi(query: string, gruppi: readonly GruppoAteco[]): EsitoAteco[] {
  const q = normalizza(query);
  if (!q) return gruppi.map((gruppo) => ({ gruppo, perche: null, punteggio: 0 }));

  const esiti: EsitoAteco[] = [];
  for (const gruppo of gruppi) {
    const sinonimi = SINONIMI.find((s) => s.gruppo === gruppo.codice)?.parole ?? [];
    // Le parole cercate non devono stare tutte nello stesso mestiere: chi
    // scrive «consulente marketing» sta nominando due volte lo stesso lavoro,
    // e nel dizionario sono due voci. Devono però trovarsi tutte dentro lo
    // stesso gruppo, altrimenti «consulente banana» uscirebbe lo stesso.
    let totale = 0;
    let migliorePerParola = 0;
    let perche: string | null = null;
    let completa = sinonimi.length > 0;

    for (const cercata of q.split(" ").filter(Boolean)) {
      let migliore = 0;
      let daChi: string | null = null;
      for (const parola of sinonimi) {
        const p = punteggioParola(cercata, normalizza(parola));
        if (p > migliore) {
          migliore = p;
          daChi = parola;
        }
      }
      if (migliore === 0) {
        completa = false;
        break;
      }
      totale += migliore;
      if (migliore > migliorePerParola) {
        migliorePerParola = migliore;
        perche = daChi;
      }
    }

    // La descrizione di legge vale meno di un mestiere: è una frase lunga e
    // simile per tutti, e da sola farebbe uscire gruppi vicini solo perché
    // contengono la parola «attività».
    const daDescrizione = punteggioParola(q, normalizza(gruppo.descrizione)) / 2;
    if (completa && totale > 0) {
      esiti.push({ gruppo, perche, punteggio: totale });
    } else if (daDescrizione > 0) {
      esiti.push({ gruppo, perche: null, punteggio: daDescrizione });
    }
  }

  return esiti.sort((a, b) => b.punteggio - a.punteggio);
}

/**
 * Quanto una ricerca somiglia a un mestiere.
 *
 * Tutte le parole cercate devono trovare posto: «consulente marketing» non
 * deve uscire su «consulente del lavoro» meglio che su «marketing». Una parola
 * che combacia per intero vale più di un prefisso, e un prefisso più di
 * niente: chi scrive «idra» sta cercando l'idraulico.
 */
function punteggioParola(query: string, bersaglio: string): number {
  const cercate = query.split(" ").filter(Boolean);
  const parole = bersaglio.split(" ").filter(Boolean);
  if (cercate.length === 0 || parole.length === 0) return 0;

  let totale = 0;
  for (const c of cercate) {
    let migliore = 0;
    for (const p of parole) {
      if (p === c) migliore = Math.max(migliore, 10);
      else if (p.startsWith(c) && c.length >= 3) migliore = Math.max(migliore, 7);
      else if (c.startsWith(p) && p.length >= 4) migliore = Math.max(migliore, 5);
      else if (p.includes(c) && c.length >= 4) migliore = Math.max(migliore, 3);
    }
    // Una parola cercata che non trova niente azzera tutto: è una ricerca
    // diversa, non una ricerca peggiore.
    if (migliore === 0) return 0;
    totale += migliore;
  }
  // Un bersaglio corto che combacia tutto vale più di uno lungo che combacia
  // in parte: «dj» su «dj» è un centro, «dj» dentro una frase è un caso.
  return totale + Math.max(0, 4 - parole.length);
}
