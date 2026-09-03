/**
 * Il calcolo di un anno intero, e la catena degli anni.
 *
 * Un anno non si calcola da solo: apre con quello che gli ha lasciato il
 * precedente — saldo di cassa, tasse accantonate, credito IVA, crediti
 * d'imposta — e chiude lasciando la stessa cosa al successivo. Questo modulo è
 * il punto in cui la catena si costruisce, una volta sola, e da cui pescano sia
 * l'interfaccia sia i test: se il test provasse un percorso diverso da quello
 * dell'app, non proverebbe niente.
 */
import { calcolaProspetto, type Prospetto } from "@/lib/fisco/motore";
import { calcolaIva, type LiquidazioneIva } from "@/lib/fisco/iva";
import {
  calcolaRiporto,
  controlliChiusura,
  proponiRegime,
  riportoVuoto,
  scostamentiDaChiusura,
  type ChiusuraAnno,
  type Controllo,
  type PropostaRegime,
  type Riporto,
  type Scostamento,
} from "@/lib/fisco/chiusura";
import { annoDi } from "@/lib/fisco/documenti";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import type {
  Costo,
  Fattura,
  NotaCredito,
  Impostazioni,
  ParametriAnno,
  VersamentoF24,
} from "@/lib/fisco/tipi";
import type { MovimentoAttivita, MovimentoPersonale } from "@/lib/dati/tipi";
import { calcolaCashflow, type Cashflow } from "./cashflow";

export type AnnoCalcolato = {
  anno: number;
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  prospetto: Prospetto;
  iva: LiquidazioneIva;
  cashflow: Cashflow;
  /** Quello che è arrivato dall'anno precedente. */
  riportoInIngresso: Riporto;
  /** Quello che questo anno lascia al successivo. */
  riportoInUscita: Riporto;
  chiusura: ChiusuraAnno | null;
  chiuso: boolean;
  regime: PropostaRegime;
  controlli: Controllo[];
  /** Cosa è cambiato dopo la chiusura. Vuoto se l'anno è aperto o nulla si è mosso. */
  scostamenti: Scostamento[];
};

export type ArchivioPerAnni = {
  impostazioni: Impostazioni[];
  fatture: Fattura[];
  note: NotaCredito[];
  costi: Costo[];
  versamenti: VersamentoF24[];
  movimentiAttivita: MovimentoAttivita[];
  movimentiPersonali: MovimentoPersonale[];
  chiusure: ChiusuraAnno[];
};

/** Oltre questo numero di anni la catena si ferma: si sta navigando, non calcolando. */
const MASSIMO_ANNI_IN_CATENA = 50;

/**
 * Gli anni da calcolare per arrivare a quello richiesto.
 *
 * Non basta l'anno chiesto: per sapere quanto era accantonato al 1° gennaio
 * bisogna aver percorso tutti gli anni precedenti in cui è successo qualcosa.
 */
export function anniDaCalcolare(archivio: ArchivioPerAnni, annoRichiesto: number): number[] {
  const anni = new Set<number>([annoRichiesto]);
  for (const i of archivio.impostazioni) anni.add(i.anno);
  for (const c of archivio.chiusure) anni.add(c.anno);
  for (const f of archivio.fatture) {
    anni.add(annoDi(f.dataEmissione));
    if (f.dataIncasso) anni.add(annoDi(f.dataIncasso));
  }
  for (const c of archivio.costi) {
    anni.add(annoDi(c.dataDocumento));
    if (c.dataPagamento) anni.add(annoDi(c.dataPagamento));
  }
  for (const v of archivio.versamenti) anni.add(annoDi(v.data));
  for (const m of archivio.movimentiAttivita) anni.add(m.anno);
  for (const m of archivio.movimentiPersonali) anni.add(m.anno);

  const primo = Math.min(...anni);
  const ultimo = Math.min(Math.max(...anni), primo + MASSIMO_ANNI_IN_CATENA);
  // La catena dev'essere continua: un anno saltato è un riporto perso.
  const continua: number[] = [];
  for (let a = primo; a <= ultimo; a++) continua.push(a);
  return continua;
}

/**
 * Calcola un anno a partire da quello che gli arriva dall'anno precedente.
 *
 * @param riportoInIngresso `null` per il primo anno della catena: solo allora il
 * saldo iniziale viene dalle impostazioni scritte a mano.
 */
export function calcolaAnno(
  anno: number,
  archivio: ArchivioPerAnni,
  riportoInIngresso: Riporto | null,
  oggi: string,
): AnnoCalcolato {
  const parametri = parametriDi(anno);
  // L'anno va forzato: per un anno senza parametri propri `parametriDi` ricade
  // sull'anno censito più recente, e le impostazioni predefinite ne erediterebbero
  // l'anno. Il motore filtra i documenti su `impostazioni.anno`, quindi un anno
  // sbagliato qui significa il prospetto di un altro anno, senza alcun errore.
  const impostazioni: Impostazioni = archivio.impostazioni.find((i) => i.anno === anno) ?? {
    ...impostazioniPredefinite(parametri),
    anno,
  };
  const entrata = riportoInIngresso ?? riportoVuoto(anno - 1);
  const chiusura = archivio.chiusure.find((c) => c.anno === anno) ?? null;

  const prospetto = calcolaProspetto({
    impostazioni,
    parametri,
    fatture: archivio.fatture,
    note: archivio.note,
    costi: archivio.costi,
    versamenti: archivio.versamenti,
    impostazioniPerAnno: archivio.impostazioni,
    creditoAnnoPrecedente: entrata.creditoImposte,
    oggi,
  });

  const iva = calcolaIva(
    prospetto.fattureCalcolate,
    prospetto.costiCalcolati,
    impostazioni,
    parametri,
    entrata.creditoIvaInLiquidazione,
    prospetto.noteCalcolate,
  );

  const cashflow = calcolaCashflow({
    anno,
    // Il primo anno apre con il saldo dichiarato nelle impostazioni; ogni anno
    // successivo apre con quello che ha lasciato il precedente.
    saldoIniziale: riportoInIngresso ? riportoInIngresso.saldoCassa : impostazioni.saldoInizialeAttivita,
    accantonatoIniziale: entrata.accantonato,
    percentualeAccantonamento: impostazioni.percentualeAccantonamento,
    fatture: prospetto.fattureCalcolate,
    costi: prospetto.costiCalcolati,
    versamenti: archivio.versamenti,
    movimentiAttivita: archivio.movimentiAttivita,
    movimentiPersonali: archivio.movimentiPersonali,
  });

  const riportoInUscita = calcolaRiporto({ anno, prospetto, iva, cashflow, chiusura });
  const regime = proponiRegime(prospetto, impostazioni, parametri);

  return {
    anno,
    impostazioni,
    parametri,
    prospetto,
    iva,
    cashflow,
    riportoInIngresso: entrata,
    riportoInUscita,
    chiusura,
    chiuso: chiusura !== null,
    regime,
    controlli: controlliChiusura({ riporto: riportoInUscita, prospetto, parametri, oggi }),
    scostamenti: chiusura ? scostamentiDaChiusura(chiusura, riportoInUscita, prospetto) : [],
  };
}

/**
 * Tutti gli anni della catena, ciascuno con i riporti di quello prima.
 * L'ordine non è un dettaglio: è la catena stessa.
 */
export function catenaAnni(
  archivio: ArchivioPerAnni,
  annoRichiesto: number,
  oggi: string,
): Map<number, AnnoCalcolato> {
  const risultato = new Map<number, AnnoCalcolato>();
  let precedente: Riporto | null = null;

  for (const anno of anniDaCalcolare(archivio, annoRichiesto)) {
    const calcolato = calcolaAnno(anno, archivio, precedente, oggi);
    risultato.set(anno, calcolato);
    precedente = calcolato.riportoInUscita;
  }

  return risultato;
}
