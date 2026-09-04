"use client";

// Dal modulo puro e non da `components/ui`: il livello dei dati non deve
// dipendere dalla presentazione, e così i test girano senza toccare JSX.
import { toast, type Raggruppamento } from "@/lib/stato/toast";
import { dimenticaImport } from "./importazioni";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import {
  conEsenzione,
  conScaglioni,
  conValoreDichiarato,
  senzaDichiarazione,
  type CampoAddizionale,
  type CampoUtente,
} from "@/lib/fisco/parametri-utente";
import type { ChiusuraAnno, DestinazioneCreditoIva } from "@/lib/fisco/chiusura";
import type { Impostazioni, Regime, ScaglioneIrpef } from "@/lib/fisco/tipi";
import {
  chiavePercorso,
  percorsoVuoto,
  NOME_CONTESTO,
  type ContestoPercorso,
  type StatoPercorso,
} from "@/lib/onboarding/percorso";
import { archivio } from "./archivio";
import { costoGrezzo, fatturaGrezza } from "@/lib/fisco/documenti";
import { notaGrezza } from "@/lib/fisco/note";
import { round2 } from "@/lib/fisco/aritmetica";
import { datiDemoConservando } from "./demo";
import type {
  Cliente,
  Costo,
  Fattura,
  NotaCredito,
  MovimentoAttivita,
  MovimentoPersonale,
  VersamentoF24,
  VocePatrimonio,
} from "./tipi";
import { nuovoId } from "./tipi";

/**
 * Le scritture, con salvataggio ottimistico e annullamento.
 *
 * Ogni modifica va a buon fine subito nell'interfaccia — la tabella è reattiva
 * sull'archivio, quindi «ottimistico» qui significa che non c'è nessuna attesa
 * di rete da mostrare — e il toast tiene per qualche secondo il valore
 * precedente, così un errore di battitura si ripara senza cercare la riga.
 */

async function conAnnullamento<T extends { id: string }>(
  deposito: {
    leggi(id: string): Promise<T | undefined>;
    salva(v: T): Promise<string>;
    elimina(id: string): Promise<void>;
  },
  id: string,
  messaggio: string,
  azione: () => Promise<void>,
  gruppo?: Raggruppamento,
): Promise<void> {
  const precedente = await deposito.leggi(id);
  await azione();
  toast.conferma(
    messaggio,
    async () => {
      if (precedente) await deposito.salva(precedente);
      else await deposito.elimina(id);
    },
    gruppo,
  );
}

/**
 * I gruppi delle modifiche in linea.
 *
 * Modificare una cella dopo l'altra è il gesto più frequente in questa app, e
 * ogni modifica è una scrittura con il suo annullamento: senza raggruppamento
 * diventano dodici toast sovrapposti sopra la tabella che si sta usando.
 * L'annullamento del gruppo disfa tutte le modifiche, dall'ultima alla prima.
 */
const GRUPPO_FATTURE: Raggruppamento = {
  chiave: "fattura-aggiornata",
  molti: (n) => `${n} fatture aggiornate`,
};
const GRUPPO_COSTI: Raggruppamento = {
  chiave: "costo-aggiornato",
  molti: (n) => `${n} costi aggiornati`,
};
const GRUPPO_CLIENTI: Raggruppamento = {
  chiave: "cliente-aggiornato",
  molti: (n) => `${n} clienti aggiornati`,
};

// ————————————————————————————————————————————————————————————
// Fatture
// ————————————————————————————————————————————————————————————

export async function salvaFattura(fattura: Fattura, messaggio = "Fattura aggiornata") {
  await conAnnullamento(
    archivio().fatture,
    fattura.id,
    messaggio,
    async () => {
      // Normalizzata qui e non nei punti di chiamata: le azioni della riga
      // passano la fattura *calcolata*, e senza questo passaggio finivano in
      // archivio anche `stato`, `iva`, `totale` e gli altri dodici derivati —
      // 23 campi invece di 9, contro la regola per cui nel database non entra
      // nulla che si possa ricalcolare. Un punto solo, che nessuno può saltare.
      await archivio().fatture.salva(fatturaGrezza(fattura));
    },
    GRUPPO_FATTURE,
  );
}

export async function creaFattura(fattura: Omit<Fattura, "id">): Promise<Fattura> {
  const nuova: Fattura = { ...fattura, id: nuovoId() };
  await archivio().fatture.salva(nuova);
  toast.conferma(`Fattura ${nuova.numero || "senza numero"} creata`, async () => {
    await archivio().fatture.elimina(nuova.id);
  });
  return nuova;
}

export async function eliminaFattura(fattura: Fattura) {
  await archivio().fatture.elimina(fattura.id);
  toast.conferma(`Fattura ${fattura.numero || "senza numero"} eliminata`, async () => {
    await archivio().fatture.salva(fattura);
  });
}

/** Azione rapida della tabella: incassata oggi, salvo diversa indicazione. */
export async function segnaIncassata(fattura: Fattura, dataIncasso?: string) {
  const data = dataIncasso ?? new Date().toISOString().slice(0, 10);
  await salvaFattura({ ...fattura, dataIncasso: data }, "Segnata come incassata");
}

export async function annullaIncasso(fattura: Fattura) {
  await salvaFattura({ ...fattura, dataIncasso: null }, "Incasso rimosso");
}

/** Il numero successivo nella serie dell'anno: 2026/001, 2026/002… */
export function prossimoNumero(fatture: Fattura[], anno: number): string {
  const prefisso = `${anno}/`;
  const progressivi = fatture
    .filter((f) => f.numero.startsWith(prefisso))
    .map((f) => Number.parseInt(f.numero.slice(prefisso.length), 10))
    .filter((n) => Number.isFinite(n));
  const prossimo = progressivi.length > 0 ? Math.max(...progressivi) + 1 : 1;
  return `${prefisso}${String(prossimo).padStart(3, "0")}`;
}

// ————————————————————————————————————————————————————————————
// Costi
// ————————————————————————————————————————————————————————————

/**
 * Salva un cliente.
 *
 * Prima le celle di `/clienti` scrivevano dritte nell'archivio, senza conferma
 * e senza annullamento: una nota cancellata per sbaglio non si recuperava.
 */
// ————————————————————————————————————————————————————————————
// Note di credito
// ————————————————————————————————————————————————————————————

const GRUPPO_NOTE: Raggruppamento = {
  chiave: "nota-aggiornata",
  molti: (n) => `${n} note aggiornate`,
};

export async function salvaNota(nota: NotaCredito, messaggio = "Nota di credito aggiornata") {
  await conAnnullamento(
    archivio().note,
    nota.id,
    messaggio,
    async () => {
      await archivio().note.salva(notaGrezza(nota));
    },
    GRUPPO_NOTE,
  );
}

export async function creaNota(nota: Omit<NotaCredito, "id">): Promise<NotaCredito> {
  const nuova: NotaCredito = { ...nota, id: nuovoId() };
  await archivio().note.salva(notaGrezza(nuova));
  toast.conferma(`Nota di credito ${nuova.numero || "senza numero"} creata`, async () => {
    await archivio().note.elimina(nuova.id);
  });
  return nuova;
}

export async function eliminaNota(nota: NotaCredito) {
  await archivio().note.elimina(nota.id);
  toast.conferma(`Nota ${nota.numero || "senza numero"} eliminata`, async () => {
    await archivio().note.salva(notaGrezza(nota));
  });
}

/** Segna il rimborso: è la data che fa scendere i ricavi per cassa. */
export async function segnaRimborsata(nota: NotaCredito, dataRimborso?: string) {
  const data = dataRimborso ?? new Date().toISOString().slice(0, 10);
  await salvaNota({ ...nota, dataRimborso: data }, "Segnata come rimborsata");
}

export async function annullaRimborso(nota: NotaCredito) {
  await salvaNota({ ...nota, dataRimborso: null }, "Rimborso rimosso");
}

/**
 * Aggancia o sgancia una nota da una fattura.
 *
 * `imponibile` a zero toglie l'aggancio. Il residuo non si tocca: si ricalcola.
 */
export async function riconcilia(nota: NotaCredito, fatturaId: string, imponibile: number) {
  const altre = (nota.riconciliazioni ?? []).filter((r) => r.fatturaId !== fatturaId);
  const importo = round2(Math.abs(imponibile));
  await salvaNota(
    {
      ...nota,
      riconciliazioni: importo > 0 ? [...altre, { fatturaId, imponibile: importo }] : altre,
    },
    importo > 0 ? "Nota riconciliata" : "Riconciliazione rimossa",
  );
}

export async function salvaCliente(cliente: Cliente, messaggio = "Cliente aggiornato") {
  await conAnnullamento(
    archivio().clienti,
    cliente.id,
    messaggio,
    async () => {
      await archivio().clienti.salva(cliente);
    },
    GRUPPO_CLIENTI,
  );
}

export async function salvaCosto(costo: Costo, messaggio = "Costo aggiornato") {
  await conAnnullamento(
    archivio().costi,
    costo.id,
    messaggio,
    async () => {
      await archivio().costi.salva(costoGrezzo(costo));
    },
    GRUPPO_COSTI,
  );
}

export async function creaCosto(costo: Omit<Costo, "id">): Promise<Costo> {
  const nuovo: Costo = { ...costo, id: nuovoId() };
  await archivio().costi.salva(nuovo);
  toast.conferma("Costo registrato", async () => {
    await archivio().costi.elimina(nuovo.id);
  });
  return nuovo;
}

export async function eliminaCosto(costo: Costo) {
  await archivio().costi.elimina(costo.id);
  toast.conferma("Costo eliminato", async () => {
    await archivio().costi.salva(costo);
  });
}

export async function segnaPagato(costo: Costo, dataPagamento?: string) {
  const data = dataPagamento ?? new Date().toISOString().slice(0, 10);
  await salvaCosto({ ...costo, dataPagamento: data }, "Segnato come pagato");
}

// ————————————————————————————————————————————————————————————
// Impostazioni
// ————————————————————————————————————————————————————————————

/*
  `cambiaRegime` stava qui e non c'è più. Scriveva il regime solo se l'anno
  aveva già una riga di impostazioni in archivio, e altrimenti usciva in
  silenzio: su un telefono aperto per la prima volta il toggle in testata non
  faceva niente, senza dire niente. Il regime ora si cambia da un posto solo,
  la configurazione, che passa da `impostazioniDellAnno` e la riga la crea.
*/

// ————————————————————————————————————————————————————————————
// Clienti
// ————————————————————————————————————————————————————————————

export async function creaCliente(nome: string): Promise<string> {
  const esistente = (await archivio().clienti.tutti()).find(
    (c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
  );
  if (esistente) return esistente.id;

  const id = nuovoId();
  await archivio().clienti.salva({
    id,
    nome: nome.trim(),
    canaleAcquisizione: "",
    note: "",
  });
  return id;
}

// ————————————————————————————————————————————————————————————
// Scadenzario
// ————————————————————————————————————————————————————————————

export function chiaveSpunta(anno: number, idAdempimento: string): string {
  return `${anno}:${idAdempimento}`;
}

export async function spuntaAdempimento(
  anno: number,
  idAdempimento: string,
  completato: boolean,
) {
  const id = chiaveSpunta(anno, idAdempimento);
  if (completato) {
    await archivio().spunte.salva({
      id,
      anno,
      idAdempimento,
      completatoIl: new Date().toISOString().slice(0, 10),
    });
  } else {
    await archivio().spunte.elimina(id);
  }
}

// ————————————————————————————————————————————————————————————
// Movimenti mensili, versamenti e patrimonio
// ————————————————————————————————————————————————————————————

export async function salvaMovimentoAttivita(
  anno: number,
  mese: number,
  modifiche: Partial<Pick<MovimentoAttivita, "altreEntrate" | "altreUscite">>,
) {
  const id = `ma-${anno}-${String(mese).padStart(2, "0")}`;
  const attuale = await archivio().movimentiAttivita.leggi(id);
  await archivio().movimentiAttivita.salva({
    id,
    anno,
    mese,
    altreEntrate: 0,
    altreUscite: 0,
    ...attuale,
    ...modifiche,
  });
}

export async function salvaMovimentoPersonale(
  anno: number,
  mese: number,
  modifiche: Partial<Omit<MovimentoPersonale, "id" | "anno" | "mese">>,
) {
  const id = `mp-${anno}-${String(mese).padStart(2, "0")}`;
  const attuale = await archivio().movimentiPersonali.leggi(id);
  await archivio().movimentiPersonali.salva({
    id,
    anno,
    mese,
    prelievi: 0,
    altreEntrate: 0,
    speseFisse: 0,
    speseVariabili: 0,
    risparmio: 0,
    ...attuale,
    ...modifiche,
  });
}

export async function creaVersamento(versamento: Omit<VersamentoF24, "id">) {
  const nuovo: VersamentoF24 = { ...versamento, id: nuovoId() };
  await archivio().versamenti.salva(nuovo);
  toast.conferma("Versamento F24 registrato", async () => {
    await archivio().versamenti.elimina(nuovo.id);
  });
}

export async function eliminaVersamento(versamento: VersamentoF24) {
  await archivio().versamenti.elimina(versamento.id);
  toast.conferma("Versamento eliminato", async () => {
    await archivio().versamenti.salva(versamento);
  });
}

export async function salvaVocePatrimonio(voce: VocePatrimonio) {
  await conAnnullamento(archivio().patrimonio, voce.id, "Voce aggiornata", async () => {
    await archivio().patrimonio.salva(voce);
  });
}

export async function creaVocePatrimonio(voce: Omit<VocePatrimonio, "id">) {
  const nuova: VocePatrimonio = { ...voce, id: nuovoId() };
  await archivio().patrimonio.salva(nuova);
  toast.conferma("Voce aggiunta al patrimonio", async () => {
    await archivio().patrimonio.elimina(nuova.id);
  });
}

export async function eliminaVocePatrimonio(voce: VocePatrimonio) {
  await archivio().patrimonio.elimina(voce.id);
  toast.conferma("Voce eliminata", async () => {
    await archivio().patrimonio.salva(voce);
  });
}

// ————————————————————————————————————————————————————————————
// Chiusura d'anno
// ————————————————————————————————————————————————————————————

/**
 * Le impostazioni di un anno, create se non esistono.
 *
 * Un anno nuovo non parte da zero: eredita il profilo di quello precedente —
 * nome, gestione previdenziale, gruppo ATECO, percentuale di accantonamento —
 * e prende dai parametri solo aliquote e soglie, che cambiano ogni gennaio.
 * Il saldo iniziale invece resta a zero di proposito: lo porta la chiusura.
 */
export async function impostazioniDellAnno(anno: number): Promise<Impostazioni> {
  const esistenti = await archivio().impostazioni.leggi(anno);
  if (esistenti) return esistenti;

  const parametri = parametriDi(anno);
  const base = impostazioniPredefinite(parametri);
  const precedente = await archivio().impostazioni.leggi(anno - 1);
  if (!precedente) return { ...base, anno };

  return {
    ...base,
    anno,
    nome: precedente.nome,
    dataAperturaPiva: precedente.dataAperturaPiva,
    regime: precedente.regime,
    gruppoAteco: precedente.gruppoAteco,
    coefficienteRedditivita: precedente.coefficienteRedditivita,
    gestione: precedente.gestione,
    periodicitaIva: precedente.periodicitaIva,
    rivalsaAttiva: precedente.rivalsaAttiva,
    ritenutaAttiva: precedente.ritenutaAttiva,
    bolloAddebitato: precedente.bolloAddebitato,
    terminiPagamento: precedente.terminiPagamento,
    percentualeAccantonamento: precedente.percentualeAccantonamento,
    mesiFondoEmergenza: precedente.mesiFondoEmergenza,
    giorniLavorativi: precedente.giorniLavorativi,
    oreFatturabiliGiorno: precedente.oreFatturabiliGiorno,
    tariffaOraria: precedente.tariffaOraria,
    nettoDesiderato: precedente.nettoDesiderato,
    costiFissiAnnui: precedente.costiFissiAnnui,
    // I parametri dichiarati passano all'anno nuovo col loro valore: l'utente
    // li ha confermati e l'app non ha modo di sapere che il comune li ha
    // ritoccati. La schermata Parametri lo ricorda anno per anno.
    addizionaleRegionale: precedente.addizionaleRegionale,
    scaglioniAddizionaleRegionale: precedente.scaglioniAddizionaleRegionale ?? null,
    esenzioneAddizionaleRegionale: precedente.esenzioneAddizionaleRegionale ?? 0,
    addizionaleComunale: precedente.addizionaleComunale,
    scaglioniAddizionaleComunale: precedente.scaglioniAddizionaleComunale ?? null,
    esenzioneAddizionaleComunale: precedente.esenzioneAddizionaleComunale ?? 0,
    contributiFissi: precedente.contributiFissi,
    aliquotaSoggettivaCassa: precedente.aliquotaSoggettivaCassa,
    dichiarati: [...(precedente.dichiarati ?? [])],
    // Il saldo iniziale non si eredita: arriva dal riporto della chiusura.
    saldoInizialeAttivita: 0,
    saldoInizialePersonale: 0,
  };
}

/**
 * Chiude un anno.
 *
 * Non congela niente e non scrive nessun importo derivato: registra la data,
 * le due decisioni (destinazione del credito IVA, regime dell'anno successivo)
 * e un'istantanea di sola lettura, che serve solo a far vedere in seguito che
 * qualcosa è cambiato. I riporti continuano a ricalcolarsi dai documenti.
 */
export async function chiudiAnno(
  chiusura: ChiusuraAnno,
  opzioni: { applicaRegime?: { anno: number; regime: Regime } } = {},
): Promise<void> {
  await archivio().chiusure.salva(chiusura);

  // Chiudere consuma l'annulla dell'ultimo import: da qui in avanti i riporti
  // dell'anno successivo poggiano su questi numeri, e toglierli da sotto senza
  // che la chiusura se ne accorga darebbe la cosa peggiore che questo progetto
  // possa produrre — un numero plausibile e sbagliato.
  await dimenticaImport();

  const regime = opzioni.applicaRegime;
  let impostazioniPrecedenti: Impostazioni | undefined;
  if (regime) {
    impostazioniPrecedenti = await archivio().impostazioni.leggi(regime.anno);
    const impostazioni = await impostazioniDellAnno(regime.anno);
    await archivio().impostazioni.salva({ ...impostazioni, regime: regime.regime });
  }

  toast.conferma(`Anno ${chiusura.anno} chiuso`, async () => {
    await archivio().chiusure.elimina(chiusura.anno);
    if (regime) {
      if (impostazioniPrecedenti) await archivio().impostazioni.salva(impostazioniPrecedenti);
      else await archivio().impostazioni.elimina(regime.anno);
    }
  });
}

/**
 * Riapre un anno chiuso.
 *
 * È la conferma che la chiusura non è mai stata uno stato irreversibile:
 * eliminare la riga riporta l'anno esattamente com'era, perché nessun numero
 * era stato scritto da nessuna parte.
 */
export async function riapriAnno(chiusura: ChiusuraAnno): Promise<void> {
  await archivio().chiusure.elimina(chiusura.anno);
  toast.conferma(`Anno ${chiusura.anno} riaperto`, async () => {
    await archivio().chiusure.salva(chiusura);
  });
}

/** Cambia la destinazione del credito IVA su un anno già chiuso. */
export async function cambiaDestinazioneCreditoIva(
  chiusura: ChiusuraAnno,
  destinazione: DestinazioneCreditoIva,
): Promise<void> {
  await archivio().chiusure.salva({ ...chiusura, destinazioneCreditoIva: destinazione });
  toast.conferma(
    destinazione === "compensazione"
      ? "Credito IVA in compensazione"
      : "Credito IVA chiesto a rimborso",
    async () => {
      await archivio().chiusure.salva(chiusura);
    },
  );
}

// ————————————————————————————————————————————————————————————
// Percorsi di configurazione
// ————————————————————————————————————————————————————————————

async function percorso(contesto: ContestoPercorso, anno: number): Promise<StatoPercorso> {
  const id = chiavePercorso(contesto, anno);
  const esistente = await archivio().percorsi.leggi(id);
  return esistente ?? percorsoVuoto(contesto, anno, new Date().toISOString());
}

/**
 * Segna un passo come affrontato.
 *
 * Confermato e saltato sono due stati diversi e si escludono: un passo saltato
 * a cui si risponde più tardi diventa confermato, e viceversa. L'app deve poter
 * dire «questo valore l'hai scelto tu» oppure «questo è il predefinito», e per
 * dirlo deve saperlo.
 */
export async function segnaPasso(
  contesto: ContestoPercorso,
  anno: number,
  passo: string,
  esito: "confermato" | "saltato",
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  const senzaIlPasso = {
    confermati: attuale.confermati.filter((p) => p !== passo),
    saltati: attuale.saltati.filter((p) => p !== passo),
  };
  await archivio().percorsi.salva({
    ...attuale,
    confermati:
      esito === "confermato" ? [...senzaIlPasso.confermati, passo] : senzaIlPasso.confermati,
    saltati: esito === "saltato" ? [...senzaIlPasso.saltati, passo] : senzaIlPasso.saltati,
    aggiornatoIl: new Date().toISOString(),
  });
}

/** Chiude il percorso. Non blocca niente: resta ripercorribile. */
export async function completaPercorso(
  contesto: ContestoPercorso,
  anno: number,
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  await archivio().percorsi.salva({
    ...attuale,
    completatoIl: new Date().toISOString(),
    aggiornatoIl: new Date().toISOString(),
  });
  toast.conferma(`${NOME_CONTESTO[contesto]} completato`, async () => {
    await archivio().percorsi.salva(attuale);
  });
}

/** Ricomincia da capo un percorso già affrontato. */
export async function ripartiPercorso(
  contesto: ContestoPercorso,
  anno: number,
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  await archivio().percorsi.salva(percorsoVuoto(contesto, anno, new Date().toISOString()));
  toast.conferma(`${NOME_CONTESTO[contesto]} ricominciato`, async () => {
    await archivio().percorsi.salva(attuale);
  });
}

/**
 * Scrive le impostazioni di un anno da dentro il percorso.
 *
 * Passa da `impostazioniDellAnno` perché un anno nuovo potrebbe non averle
 * ancora: risponder a una domanda deve poterle creare, non fallire in silenzio.
 */
export async function aggiornaImpostazioni(
  anno: number,
  modifiche: Partial<Impostazioni>,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva({ ...attuali, ...modifiche, anno });
}

/**
 * Dichiara un parametro che solo l'utente conosce.
 *
 * Scrive il valore e lo marca come confermato: da quel momento l'app smette di
 * chiamarlo predefinito, e il prospetto torna esportabile se era quello a
 * bloccarlo.
 */
export async function dichiaraParametro(
  anno: number,
  campo: CampoUtente,
  valore: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conValoreDichiarato(attuali, campo, valore));
}

/**
 * Scrive gli scaglioni di un'addizionale, o torna all'aliquota unica.
 *
 * `conferma` è falso quando si sta solo scegliendo la forma della risposta:
 * le righe partono dall'aliquota media, e finché nessuno le tocca il parametro
 * resta predefinito — altrimenti il PDF si sbloccherebbe su numeri dell'app.
 */
export async function dichiaraScaglioni(
  anno: number,
  campo: CampoAddizionale,
  scaglioni: ScaglioneIrpef[] | null,
  conferma = true,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conScaglioni(attuali, campo, scaglioni, conferma));
}

/** Scrive la soglia sotto la quale l'addizionale non è dovuta. */
export async function dichiaraEsenzione(
  anno: number,
  campo: CampoAddizionale,
  valore: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conEsenzione(attuali, campo, valore));
}

/**
 * Rimette un parametro al predefinito dell'app.
 *
 * Serve a poter dire «non lo so» dopo aver detto un numero sbagliato: senza
 * questa strada, chi sbaglia a copiare l'aliquota resta con un valore suo e
 * falso, marcato come confermato.
 */
export async function ripristinaParametro(anno: number, campo: CampoUtente): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  const predefinite = impostazioniPredefinite(parametriDi(anno));
  await archivio().impostazioni.salva(
    senzaDichiarazione(attuali, campo, predefinite[campo]),
  );
}

/**
 * Carica il dataset dimostrativo dal percorso di primo avvio.
 *
 * Sostituisce i documenti ma non la configurazione: le risposte appena date
 * restano, e le schermate si popolano con le regole scelte da chi guarda.
 * L'archivio precedente viene tenuto da parte per l'annullamento.
 */
export async function caricaDatasetDimostrativo(): Promise<void> {
  const precedente = await archivio().leggiTutto();
  await archivio().scriviTutto(
    datiDemoConservando(precedente, { impostazioni: true, percorsi: true }),
    "sostituisci",
  );
  toast.conferma("Dati dimostrativi caricati", async () => {
    await archivio().scriviTutto(precedente, "sostituisci");
  });
}
