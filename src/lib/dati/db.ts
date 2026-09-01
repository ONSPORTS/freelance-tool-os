import Dexie, { type EntityTable } from "dexie";
import type {
  Cliente,
  Costo,
  Fattura,
  Impostazioni,
  MovimentoAttivita,
  MovimentoPersonale,
  VersamentoF24,
  SpuntaAdempimento,
  VocePatrimonio,
} from "./tipi";

/**
 * Lo schema IndexedDB.
 *
 * Gli indici sono scelti sulle interrogazioni che l'app fa davvero: le date di
 * incasso e pagamento (il principio di cassa), le date dei documenti (la
 * liquidazione IVA) e il cliente (concentrazione del portafoglio).
 * Nessun campo derivato è indicizzato, perché nessun campo derivato è salvato.
 */
export const VERSIONE_SCHEMA = 2;

export class DatabaseFinanze extends Dexie {
  impostazioni!: EntityTable<Impostazioni, "anno">;
  clienti!: EntityTable<Cliente, "id">;
  fatture!: EntityTable<Fattura, "id">;
  costi!: EntityTable<Costo, "id">;
  movimentiPersonali!: EntityTable<MovimentoPersonale, "id">;
  movimentiAttivita!: EntityTable<MovimentoAttivita, "id">;
  versamenti!: EntityTable<VersamentoF24, "id">;
  patrimonio!: EntityTable<VocePatrimonio, "id">;
  spunte!: EntityTable<SpuntaAdempimento, "id">;

  constructor(nome = "freelance-finance-os") {
    super(nome);
    // Versione 1: lo schema iniziale.
    this.version(1).stores({
      impostazioni: "anno",
      clienti: "id, nome",
      fatture: "id, dataEmissione, dataIncasso, clienteId, numero",
      costi: "id, dataDocumento, dataPagamento, categoria",
      movimentiPersonali: "id, [anno+mese]",
      movimentiAttivita: "id, [anno+mese]",
      versamenti: "id, data, tipo",
      patrimonio: "id, tipo",
    });
    // Versione 2: le spunte dello scadenzario. Aggiungere una tabella non
    // richiede migrazione: i dati esistenti restano dove sono.
    this.version(2).stores({
      spunte: "id, anno",
    });
  }
}

let istanza: DatabaseFinanze | null = null;

/** Istanza condivisa. Creata alla prima richiesta, mai durante il render sul server. */
export function db(): DatabaseFinanze {
  if (!istanza) istanza = new DatabaseFinanze();
  return istanza;
}
