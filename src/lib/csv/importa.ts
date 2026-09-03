/**
 * Dal CSV alle entità dell'app.
 *
 * Modulo puro: prende righe di testo e una mappatura, restituisce fatture,
 * costi, spese personali e l'elenco di ciò che non ha saputo leggere. Non
 * scrive niente — la scrittura, e il suo annullamento, stanno in
 * `lib/dati/importazioni.ts`.
 *
 * La regola di fondo: **una riga illeggibile non ferma le altre**. Si importa
 * il resto e si dice riga per riga cosa è stato scartato e perché, con il
 * numero di riga del file, che è l'unico riferimento che l'utente ha per
 * andarlo a correggere.
 */
import { analizzaData, analizzaNumero, analizzaPercentuale } from "@/lib/format";
import { round2 } from "@/lib/fisco/aritmetica";
import { campoDi } from "./parser";
import type { Destinazione, Mappatura } from "./campi";
import type { Cliente, Costo, Fattura, NotaCredito } from "@/lib/dati/tipi";

/** Che cosa fare con le righe già presenti in archivio. */
export type SuiDuplicati = "importa" | "salta" | "sostituisci";

export type Piano = {
  destinazione: Destinazione;
  mappatura: Mappatura;
  /**
   * I valori della colonna «Attività o personale» che indicano una spesa
   * personale. Confrontati senza distinzione di maiuscole e spazi.
   */
  valoriPersonali: string[];
  suiDuplicati: SuiDuplicati;
  /** Aliquota IVA usata quando la colonna manca. */
  aliquotaPredefinita: number;
  /** Le spese personali importate sono fisse o variabili. */
  spesePersonaliFisse: boolean;
};

export type RigaScartata = {
  /** Numero di riga nel file, intestazione compresa: è quello che si vede in Excel. */
  riga: number;
  motivo: string;
  /** Le prime celle, per riconoscerla senza riaprire il file. */
  anteprima: string;
};

/** Una spesa personale non è una riga: confluisce nel mese. */
export type SpesaPersonale = {
  riga: number;
  anno: number;
  mese: number;
  importo: number;
  descrizione: string;
};

export type FatturaLetta = { riga: number; fattura: Fattura; nomeCliente: string };
export type NotaLetta = { riga: number; nota: NotaCredito; nomeCliente: string };
export type CostoLetto = { riga: number; costo: Costo };

export type Lettura = {
  fatture: FatturaLetta[];
  /** Le righe riconosciute come note di credito dalla colonna «Tipo di documento». */
  note: NotaLetta[];
  costi: CostoLetto[];
  personali: SpesaPersonale[];
  scartate: RigaScartata[];
  /** Nomi che non corrispondono a nessun cliente in archivio: saranno creati. */
  clientiDaCreare: string[];
  /** Righe che coincidono con qualcosa di già presente. */
  duplicati: { riga: number; descrizione: string; idEsistente: string }[];
};

/**
 * Le diciture con cui i gestionali chiamano una nota di credito.
 *
 * Confrontate senza spazi né punteggiatura, così «Nota di credito», «NOTA
 * CREDITO» e «nota_di_credito» cadono tutte insieme.
 */
const DICITURE_NOTA = ["notadicredito", "notacredito", "nc", "notedicredito", "creditnote", "reso"];

export function eNotaDiCredito(valore: string): boolean {
  const v = chiaveNome(valore);
  return v !== "" && DICITURE_NOTA.includes(v);
}

const TIPI_RICAVO: Record<string, Fattura["tipoRicavo"]> = {
  ricorrente: "ricorrente",
  progetto: "progetto",
  unatantum: "unaTantum",
  "una tantum": "unaTantum",
};

/**
 * La chiave con cui due nomi sono «lo stesso».
 *
 * Via tutto quello che non è una lettera o una cifra, non sostituito da uno
 * spazio ma tolto: «Alfa Srl», «ALFA S.r.l.» e «Alfa  S. R. L.» devono cadere
 * sulla stessa chiave, e sostituendo con lo spazio non ci cadono. È il caso
 * normale in un estratto conto, dove la stessa controparte compare scritta in
 * tre modi diversi — e ogni variante diventerebbe un cliente nuovo.
 */
function chiaveNome(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Legge le righe.
 *
 * @param inizioRighe numero della prima riga di dati nel file (2 con
 * l'intestazione): serve perché i messaggi citino il numero che si legge in
 * Excel, non l'indice dell'array.
 */
export function interpreta(
  righe: string[][],
  piano: Piano,
  esistenti: { fatture: Fattura[]; costi: Costo[]; clienti: Cliente[] },
  { inizioRighe = 2, id = generaId }: { inizioRighe?: number; id?: () => string } = {},
): Lettura {
  const m = piano.mappatura;
  const out: Lettura = {
    fatture: [],
    note: [],
    costi: [],
    personali: [],
    scartate: [],
    clientiDaCreare: [],
    duplicati: [],
  };

  const perNome = new Map(esistenti.clienti.map((c) => [chiaveNome(c.nome), c]));
  const nuoviNomi = new Map<string, string>();
  const personali = new Set(piano.valoriPersonali.map((v) => chiaveNome(v)));

  // Indici del già presente, per il rilevamento dei duplicati.
  const fattureEsistenti = new Map(
    esistenti.fatture.map((f) => [`${chiaveNome(f.numero)}|${f.dataEmissione}`, f.id]),
  );
  const costiEsistenti = new Map(
    esistenti.costi.map((c) => [
      `${chiaveNome(c.fornitore)}|${c.dataDocumento}|${round2(c.imponibile)}`,
      c.id,
    ]),
  );

  let progressivo = 0;

  righe.forEach((riga, indice) => {
    const numeroRiga = indice + inizioRighe;
    const anteprima = riga.slice(0, 4).filter(Boolean).join(" · ").slice(0, 80);
    const scarta = (motivo: string) => out.scartate.push({ riga: numeroRiga, motivo, anteprima });

    const dataGrezza = campoDi(riga, m.data ?? null);
    const data = analizzaData(dataGrezza);
    if (data === null) {
      scarta(
        dataGrezza === ""
          ? "manca la data"
          : `la data «${dataGrezza}» non è leggibile (attese gg/mm/aaaa o aaaa-mm-gg)`,
      );
      return;
    }

    const importoGrezzo = campoDi(riga, m.imponibile ?? null);
    const importo = analizzaNumero(importoGrezzo);
    if (importo === null) {
      scarta(importoGrezzo === "" ? "manca l'importo" : `l'importo «${importoGrezzo}» non è un numero`);
      return;
    }
    if (importo === 0) {
      scarta("l'importo è zero");
      return;
    }

    const descrizione = campoDi(riga, m.descrizione ?? null);
    const aliquotaGrezza = campoDi(riga, m.aliquotaIva ?? null);
    const aliquota =
      aliquotaGrezza === "" ? piano.aliquotaPredefinita : analizzaPercentuale(aliquotaGrezza);
    if (aliquota === null || aliquota < 0 || aliquota > 1) {
      scarta(`l'aliquota IVA «${aliquotaGrezza}» non è una percentuale valida`);
      return;
    }

    if (piano.destinazione === "fattura") {
      const nome = campoDi(riga, m.controparte ?? null);
      if (nome === "") {
        scarta("manca il cliente");
        return;
      }
      const chiave = chiaveNome(nome);
      let clienteId = perNome.get(chiave)?.id ?? nuoviNomi.get(chiave);
      if (!clienteId) {
        clienteId = id();
        nuoviNomi.set(chiave, clienteId);
        out.clientiDaCreare.push(nome);
      }

      const numero = campoDi(riga, m.numero ?? null) || `IMP-${++progressivo}`;
      const dataIncasso = analizzaData(campoDi(riga, m.dataCassa ?? null));

      // Una nota di credito non è una fattura col meno: è un documento a sé, e
      // la colonna «Documento» dei gestionali lo dice già.
      if (eNotaDiCredito(campoDi(riga, m.documento ?? null))) {
        out.note.push({
          riga: numeroRiga,
          nomeCliente: nome,
          nota: {
            id: id(),
            dataDocumento: data,
            numero,
            clienteId,
            descrizione,
            imponibile: round2(Math.abs(importo)),
            aliquotaIva: aliquota,
            // La colonna dell'incasso, su una nota, è la data del rimborso.
            dataRimborso: dataIncasso,
            riconciliazioni: [],
          },
        });
        return;
      }

      const tipo = TIPI_RICAVO[campoDi(riga, m.tipoRicavo ?? null).toLowerCase()] ?? "progetto";

      const esistente = fattureEsistenti.get(`${chiaveNome(numero)}|${data}`);
      if (esistente) {
        out.duplicati.push({
          riga: numeroRiga,
          descrizione: `${numero} del ${dataGrezza}`,
          idEsistente: esistente,
        });
        if (piano.suiDuplicati === "salta") return;
      }

      out.fatture.push({
        riga: numeroRiga,
        nomeCliente: nome,
        fattura: {
          id: piano.suiDuplicati === "sostituisci" && esistente ? esistente : id(),
          dataEmissione: data,
          numero,
          clienteId,
          descrizione,
          tipoRicavo: tipo,
          imponibile: round2(Math.abs(importo)),
          aliquotaIva: aliquota,
          dataIncasso,
        },
      });
      return;
    }

    // Costi e spese personali: stessa forma, destinazione diversa.
    const natura = campoDi(riga, m.natura ?? null);
    if (natura !== "" && personali.has(chiaveNome(natura))) {
      out.personali.push({
        riga: numeroRiga,
        anno: Number(data.slice(0, 4)),
        mese: Number(data.slice(5, 7)),
        importo: round2(Math.abs(importo)),
        descrizione: descrizione || natura,
      });
      return;
    }

    const fornitore = campoDi(riga, m.controparte ?? null);
    if (fornitore === "") {
      scarta("manca il fornitore");
      return;
    }
    const deducibilita = analizzaPercentuale(campoDi(riga, m.deducibilita ?? null));
    const imponibile = round2(Math.abs(importo));
    const esistente = costiEsistenti.get(`${chiaveNome(fornitore)}|${data}|${imponibile}`);
    if (esistente) {
      out.duplicati.push({
        riga: numeroRiga,
        descrizione: `${fornitore} del ${dataGrezza}`,
        idEsistente: esistente,
      });
      if (piano.suiDuplicati === "salta") return;
    }

    out.costi.push({
      riga: numeroRiga,
      costo: {
        id: piano.suiDuplicati === "sostituisci" && esistente ? esistente : id(),
        dataDocumento: data,
        fornitore,
        categoria: campoDi(riga, m.categoria ?? null) || "Altro",
        descrizione,
        natura: "variabile",
        imponibile,
        aliquotaIva: aliquota,
        percentualeDeducibilita: deducibilita === null ? 1 : deducibilita,
        dataPagamento: analizzaData(campoDi(riga, m.dataCassa ?? null)),
      },
    });
  });

  return out;
}

/** I valori distinti di una colonna, per far scegliere quali sono personali. */
export function valoriDistinti(righe: string[][], colonna: number | null, massimo = 40): string[] {
  if (colonna === null) return [];
  const visti = new Map<string, string>();
  for (const riga of righe) {
    const v = campoDi(riga, colonna);
    if (v === "") continue;
    if (!visti.has(chiaveNome(v))) visti.set(chiaveNome(v), v);
    if (visti.size >= massimo) break;
  }
  return [...visti.values()].sort((a, b) => a.localeCompare(b, "it"));
}

/** Parole che di solito indicano una spesa privata, per la prima spunta. */
const INDIZI_PERSONALI = [
  "personale", "privato", "privata", "famiglia", "casa", "spesa", "supermercato",
  "farmacia", "salute", "svago", "tempo libero", "ristorante", "abbigliamento",
];

export function sembraPersonale(valore: string): boolean {
  const v = chiaveNome(valore);
  // Anche gli indizi passano da `chiaveNome`: il valore ha già perso gli spazi,
  // e confrontarlo con «tempo libero» così com'è scritto non troverebbe mai
  // niente. Gli indizi di due parole smetterebbero di funzionare in silenzio.
  return INDIZI_PERSONALI.some((i) => v.includes(chiaveNome(i)));
}

function generaId(): string {
  return crypto.randomUUID();
}
