/**
 * Export e import del file di backup.
 *
 * È l'unico modo per portare i dati su un altro dispositivo, quindi deve essere
 * leggibile a occhio, verificabile e severo in lettura: un file sbagliato va
 * respinto con un messaggio comprensibile, non importato a metà.
 *
 * L'import ripulisce anche i campi derivati: se un file ne contiene, vengono
 * scartati. Nel database non deve finire nulla che si possa ricalcolare.
 */
import { VERSIONE_SCHEMA } from "./db";
import {
  COLLEZIONI,
  datiVuoti,
  type Dati,
  type NomeCollezione,
} from "./tipi";

export const FORMATO = "freelance-finance-os";

export type Backup = {
  formato: typeof FORMATO;
  versioneSchema: number;
  esportatoIl: string;
  dati: Dati;
};

export type RisultatoAnalisi =
  | { ok: true; backup: Backup; avvisi: string[] }
  | { ok: false; errori: string[] };

export function creaBackup(dati: Dati, adesso = new Date()): Backup {
  return {
    formato: FORMATO,
    versioneSchema: VERSIONE_SCHEMA,
    esportatoIl: adesso.toISOString(),
    dati,
  };
}

export function serializzaBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** Nome file parlante: `freelance-finance-os-2026-09-01.json`. */
export function nomeFileBackup(adesso = new Date()): string {
  return `${FORMATO}-${adesso.toISOString().slice(0, 10)}.json`;
}

// ————————————————————————————————————————————————————————————
// Validazione
// ————————————————————————————————————————————————————————————

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function oggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function testo(v: unknown, predefinito = ""): string {
  return typeof v === "string" ? v : predefinito;
}

function numero(v: unknown, predefinito = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : predefinito;
}

function booleano(v: unknown, predefinito = false): boolean {
  return typeof v === "boolean" ? v : predefinito;
}

function dataOpzionale(v: unknown): string | null {
  return typeof v === "string" && ISO_DATA.test(v) ? v : null;
}

function fraZeroEUno(v: unknown, predefinito: number): number {
  const n = numero(v, predefinito);
  return n >= 0 && n <= 1 ? n : predefinito;
}

type Convalida<T> = (riga: Record<string, unknown>, indice: number, errori: string[]) => T | null;

function convalidaElenco<T>(
  valore: unknown,
  collezione: NomeCollezione,
  convalida: Convalida<T>,
  errori: string[],
): T[] {
  if (valore === undefined) return [];
  if (!Array.isArray(valore)) {
    errori.push(`La collezione «${collezione}» non è un elenco.`);
    return [];
  }
  const risultato: T[] = [];
  for (const [indice, riga] of valore.entries()) {
    if (!oggetto(riga)) {
      errori.push(`${collezione}, riga ${indice + 1}: non è un oggetto.`);
      continue;
    }
    const convalidata = convalida(riga, indice, errori);
    if (convalidata) risultato.push(convalidata);
  }
  return risultato;
}

function richiedeId(
  riga: Record<string, unknown>,
  collezione: NomeCollezione,
  indice: number,
  errori: string[],
): string | null {
  const id = testo(riga.id);
  if (!id) {
    errori.push(`${collezione}, riga ${indice + 1}: manca l'identificatore.`);
    return null;
  }
  return id;
}

const convalidaFattura: Convalida<Dati["fatture"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "fatture", i, errori);
  if (!id) return null;
  const dataEmissione = dataOpzionale(riga.dataEmissione);
  if (!dataEmissione) {
    errori.push(`fatture, riga ${i + 1}: data di emissione mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const imponibile = numero(riga.imponibile, Number.NaN);
  if (!Number.isFinite(imponibile)) {
    errori.push(`fatture, riga ${i + 1}: imponibile mancante o non numerico.`);
    return null;
  }
  const tipo = riga.tipoRicavo;
  return {
    id,
    dataEmissione,
    numero: testo(riga.numero),
    clienteId: testo(riga.clienteId),
    descrizione: testo(riga.descrizione),
    tipoRicavo:
      tipo === "ricorrente" || tipo === "progetto" || tipo === "unaTantum" ? tipo : "progetto",
    imponibile,
    ...(typeof riga.aliquotaIva === "number"
      ? { aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0) }
      : {}),
    dataIncasso: dataOpzionale(riga.dataIncasso),
  };
};

const convalidaCosto: Convalida<Dati["costi"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "costi", i, errori);
  if (!id) return null;
  const dataDocumento = dataOpzionale(riga.dataDocumento);
  if (!dataDocumento) {
    errori.push(`costi, riga ${i + 1}: data del documento mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const imponibile = numero(riga.imponibile, Number.NaN);
  if (!Number.isFinite(imponibile)) {
    errori.push(`costi, riga ${i + 1}: imponibile mancante o non numerico.`);
    return null;
  }
  return {
    id,
    dataDocumento,
    fornitore: testo(riga.fornitore),
    categoria: testo(riga.categoria, "Altro"),
    descrizione: testo(riga.descrizione),
    natura: riga.natura === "fisso" ? "fisso" : "variabile",
    imponibile,
    aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0),
    percentualeDeducibilita: fraZeroEUno(riga.percentualeDeducibilita, 1),
    percentualeDetraibilitaIva: fraZeroEUno(riga.percentualeDetraibilitaIva, 1),
    dataPagamento: dataOpzionale(riga.dataPagamento),
  };
};

const convalidaCliente: Convalida<Dati["clienti"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "clienti", i, errori);
  if (!id) return null;
  const nome = testo(riga.nome);
  if (!nome) {
    errori.push(`clienti, riga ${i + 1}: manca il nome.`);
    return null;
  }
  return {
    id,
    nome,
    ...(typeof riga.colore === "string" ? { colore: riga.colore } : {}),
    canaleAcquisizione: testo(riga.canaleAcquisizione),
    note: testo(riga.note),
  };
};

const convalidaMovimentoPersonale: Convalida<Dati["movimentiPersonali"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "movimentiPersonali", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    mese: numero(riga.mese, 1),
    prelievi: numero(riga.prelievi),
    altreEntrate: numero(riga.altreEntrate),
    speseFisse: numero(riga.speseFisse),
    speseVariabili: numero(riga.speseVariabili),
    risparmio: numero(riga.risparmio),
  };
};

const convalidaMovimentoAttivita: Convalida<Dati["movimentiAttivita"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "movimentiAttivita", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    mese: numero(riga.mese, 1),
    altreEntrate: numero(riga.altreEntrate),
    altreUscite: numero(riga.altreUscite),
  };
};

const convalidaVersamento: Convalida<Dati["versamenti"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "versamenti", i, errori);
  if (!id) return null;
  const data = dataOpzionale(riga.data);
  if (!data) {
    errori.push(`versamenti, riga ${i + 1}: data mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const tipo = riga.tipo;
  return {
    id,
    data,
    tipo: tipo === "iva" || tipo === "imposte" || tipo === "contributi" ? tipo : "imposte",
    importo: numero(riga.importo),
  };
};

const convalidaSpunta: Convalida<Dati["spunte"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "spunte", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    idAdempimento: testo(riga.idAdempimento),
    completatoIl: dataOpzionale(riga.completatoIl) ?? new Date().toISOString().slice(0, 10),
  };
};

const convalidaVocePatrimonio: Convalida<Dati["patrimonio"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "patrimonio", i, errori);
  if (!id) return null;
  return {
    id,
    tipo: riga.tipo === "passivo" ? "passivo" : "attivo",
    categoria: testo(riga.categoria),
    descrizione: testo(riga.descrizione),
    valore: numero(riga.valore),
  };
};

const convalidaImpostazioni: Convalida<Dati["impostazioni"][number]> = (riga, i, errori) => {
  const anno = numero(riga.anno, Number.NaN);
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
    errori.push(`impostazioni, riga ${i + 1}: anno mancante o fuori intervallo.`);
    return null;
  }
  const scaglioni = Array.isArray(riga.scaglioniIrpef)
    ? riga.scaglioniIrpef
        .filter(oggetto)
        .map((s) => ({
          limite: typeof s.limite === "number" ? s.limite : null,
          aliquota: fraZeroEUno(s.aliquota, 0),
        }))
    : [];
  if (scaglioni.length === 0) {
    errori.push(`impostazioni, riga ${i + 1}: scaglioni IRPEF mancanti.`);
    return null;
  }
  const regime = riga.regime === "ordinario" ? "ordinario" : "forfettario";
  const gestione =
    riga.gestione === "artigiani" || riga.gestione === "cassa" ? riga.gestione : "separata";
  return {
    anno,
    nome: testo(riga.nome),
    dataAperturaPiva: dataOpzionale(riga.dataAperturaPiva),
    saldoInizialeAttivita: numero(riga.saldoInizialeAttivita),
    saldoInizialePersonale: numero(riga.saldoInizialePersonale),
    regime,
    gruppoAteco: testo(riga.gruppoAteco, "professionali"),
    coefficienteRedditivita: fraZeroEUno(riga.coefficienteRedditivita, 0.78),
    nuovaAttivita: booleano(riga.nuovaAttivita),
    aliquotaSostitutiva: fraZeroEUno(riga.aliquotaSostitutiva, 0.15),
    limiteForfettario: numero(riga.limiteForfettario, 85_000),
    sogliaUscita: numero(riga.sogliaUscita, 100_000),
    aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0.22),
    periodicitaIva: riga.periodicitaIva === "mensile" ? "mensile" : "trimestrale",
    maggiorazioneTrimestrale: fraZeroEUno(riga.maggiorazioneTrimestrale, 0.01),
    scaglioniIrpef: scaglioni,
    addizionaleRegionale: fraZeroEUno(riga.addizionaleRegionale, 0),
    addizionaleComunale: fraZeroEUno(riga.addizionaleComunale, 0),
    detrazioniPersonali: numero(riga.detrazioniPersonali),
    fondoPensione: numero(riga.fondoPensione),
    gestione,
    aliquotaGestioneSeparata: fraZeroEUno(riga.aliquotaGestioneSeparata, 0.2607),
    massimaleGs: numero(riga.massimaleGs, 122_295),
    minimaleGs: numero(riga.minimaleGs, 18_808),
    contributiFissi: numero(riga.contributiFissi),
    minimaleArtigiani: numero(riga.minimaleArtigiani, 18_555),
    aliquotaEccedenza: fraZeroEUno(riga.aliquotaEccedenza, 0.2448),
    aliquotaSoggettivaCassa: fraZeroEUno(riga.aliquotaSoggettivaCassa, 0.15),
    aliquotaIntegrativaCassa: fraZeroEUno(riga.aliquotaIntegrativaCassa, 0.04),
    rivalsaAttiva: booleano(riga.rivalsaAttiva),
    aliquotaRivalsa: fraZeroEUno(riga.aliquotaRivalsa, 0.04),
    ritenutaAttiva: booleano(riga.ritenutaAttiva),
    aliquotaRitenuta: fraZeroEUno(riga.aliquotaRitenuta, 0.2),
    importoBollo: numero(riga.importoBollo, 2),
    sogliaBollo: numero(riga.sogliaBollo, 77.47),
    bolloAddebitato: booleano(riga.bolloAddebitato, true),
    terminiPagamento: numero(riga.terminiPagamento, 30),
    giorniLavorativi: numero(riga.giorniLavorativi, 220),
    oreFatturabiliGiorno: numero(riga.oreFatturabiliGiorno, 5),
    tariffaOraria: numero(riga.tariffaOraria),
    nettoDesiderato: numero(riga.nettoDesiderato),
    percentualeAccantonamento: fraZeroEUno(riga.percentualeAccantonamento, 0.3),
    mesiFondoEmergenza: numero(riga.mesiFondoEmergenza, 6),
    costiFissiAnnui: numero(riga.costiFissiAnnui),
  };
};

/**
 * Legge un file di backup. Non lancia mai: restituisce gli errori da mostrare
 * all'utente, perché un import fallito non deve somigliare a un crash.
 */
export function analizzaBackup(testoGrezzo: string): RisultatoAnalisi {
  let radice: unknown;
  try {
    radice = JSON.parse(testoGrezzo);
  } catch {
    return { ok: false, errori: ["Il file non è JSON valido."] };
  }
  if (!oggetto(radice)) {
    return { ok: false, errori: ["Il file non contiene un oggetto di backup."] };
  }
  if (radice.formato !== FORMATO) {
    return {
      ok: false,
      errori: [
        "Questo file non è un backup di Freelance Finance OS: manca il marcatore di formato.",
      ],
    };
  }

  const avvisi: string[] = [];
  const versione = numero(radice.versioneSchema, 0);
  if (versione > VERSIONE_SCHEMA) {
    return {
      ok: false,
      errori: [
        `Il file è stato creato con una versione più recente dell'app (schema ${versione}, qui ${VERSIONE_SCHEMA}). Aggiorna l'app prima di importarlo.`,
      ],
    };
  }
  if (versione < VERSIONE_SCHEMA) {
    avvisi.push(
      `Backup con schema ${versione}, più vecchio dell'attuale (${VERSIONE_SCHEMA}): i campi mancanti prendono i valori predefiniti.`,
    );
  }

  const contenuto = oggetto(radice.dati) ? radice.dati : {};
  const errori: string[] = [];
  const dati = datiVuoti();
  dati.impostazioni = convalidaElenco(contenuto.impostazioni, "impostazioni", convalidaImpostazioni, errori);
  dati.clienti = convalidaElenco(contenuto.clienti, "clienti", convalidaCliente, errori);
  dati.fatture = convalidaElenco(contenuto.fatture, "fatture", convalidaFattura, errori);
  dati.costi = convalidaElenco(contenuto.costi, "costi", convalidaCosto, errori);
  dati.movimentiPersonali = convalidaElenco(
    contenuto.movimentiPersonali, "movimentiPersonali", convalidaMovimentoPersonale, errori,
  );
  dati.movimentiAttivita = convalidaElenco(
    contenuto.movimentiAttivita, "movimentiAttivita", convalidaMovimentoAttivita, errori,
  );
  dati.versamenti = convalidaElenco(contenuto.versamenti, "versamenti", convalidaVersamento, errori);
  dati.patrimonio = convalidaElenco(contenuto.patrimonio, "patrimonio", convalidaVocePatrimonio, errori);
  dati.spunte = convalidaElenco(contenuto.spunte, "spunte", convalidaSpunta, errori);

  if (errori.length > 0) return { ok: false, errori };

  // Le fatture che puntano a un cliente inesistente restano importabili: meglio
  // un dato orfano visibile che un import respinto in blocco.
  const idClienti = new Set(dati.clienti.map((c) => c.id));
  const orfane = dati.fatture.filter((f) => f.clienteId && !idClienti.has(f.clienteId)).length;
  if (orfane > 0) {
    avvisi.push(
      `${orfane} ${orfane === 1 ? "fattura fa riferimento a un cliente" : "fatture fanno riferimento a clienti"} non presenti nel backup.`,
    );
  }

  return {
    ok: true,
    backup: {
      formato: FORMATO,
      versioneSchema: versione,
      esportatoIl: testo(radice.esportatoIl, new Date().toISOString()),
      dati,
    },
    avvisi,
  };
}

export { COLLEZIONI };
