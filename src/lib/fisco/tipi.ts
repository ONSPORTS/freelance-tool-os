/**
 * Tipi del motore fiscale. Modulo puro: nessun import di React, nessun accesso
 * al database. Solo funzioni da input a output.
 */

export type Regime = "forfettario" | "ordinario";
export type Gestione = "separata" | "artigiani" | "cassa";
export type PeriodicitaIva = "mensile" | "trimestrale";
export type TipoRicavo = "ricorrente" | "progetto" | "unaTantum";
export type NaturaCosto = "fisso" | "variabile";
export type TipoVersamento = "iva" | "imposte" | "contributi";

export type ScaglioneIrpef = {
  /** Limite superiore dello scaglione. `null` per l'ultimo, che non ha tetto. */
  limite: number | null;
  aliquota: number;
};

export type GruppoAteco = {
  codice: string;
  descrizione: string;
  coefficiente: number;
};

/**
 * Parametri di legge, versionati per anno in `parametri/<anno>.ts`.
 * Aliquote e soglie non si scrivono nel codice: l'aggiornamento di gennaio
 * è la modifica di un file solo.
 */
export type ParametriAnno = {
  anno: number;
  /** Da citare nell'interfaccia accanto ai parametri. */
  fonti: string[];
  /**
   * I valori sono ereditati da un anno precedente, in attesa della Legge di
   * Bilancio. Finché è `true` l'interfaccia lo dichiara e il prospetto non si
   * può esportare: un documento che sembra definitivo e poggia su aliquote
   * dell'anno prima non deve poter uscire dall'app.
   */
  provvisorio: boolean;

  limiteForfettario: number;
  sogliaUscitaImmediata: number;
  /** Frazione del limite oltre la quale scatta l'avviso preventivo. */
  sogliaAvviso: number;
  aliquotaSostitutiva: number;
  aliquotaSostitutivaNuovaAttivita: number;
  anniNuovaAttivita: number;
  gruppiAteco: GruppoAteco[];

  scaglioniIrpef: ScaglioneIrpef[];
  tettoFondoPensione: number;

  aliquotaGestioneSeparata: number;
  massimaleGestioneSeparata: number;
  minimaleAccreditoGestioneSeparata: number;
  minimaleArtigiani: number;
  aliquotaEccedenzaArtigiani: number;

  aliquotaIvaOrdinaria: number;
  maggiorazioneTrimestrale: number;
  /** Il saldo del 4° trimestre si versa con la dichiarazione annuale, senza l'1%. */
  maggiorazioneSuQuartoTrimestre: boolean;

  aliquotaRivalsaInps: number;
  aliquotaRitenuta: number;
  importoBollo: number;
  sogliaBollo: number;

  /** Sotto questa soglia di imposta dovuta non si versano acconti. */
  sogliaAcconti: number;
  /** Sotto questa soglia l'acconto è unico, a novembre. */
  sogliaAccontoUnico: number;
  quotaPrimoAcconto: number;
  quotaSecondoAcconto: number;
  rateRateizzazione: number;
  interesseRateizzazioneMensile: number;
};

/** Le impostazioni dell'utente per un anno. Una per anno: i parametri cambiano. */
export type Impostazioni = {
  anno: number;
  nome: string;
  dataAperturaPiva: string | null;
  saldoInizialeAttivita: number;
  saldoInizialePersonale: number;

  regime: Regime;
  gruppoAteco: string;
  coefficienteRedditivita: number;
  nuovaAttivita: boolean;
  aliquotaSostitutiva: number;
  limiteForfettario: number;
  sogliaUscita: number;

  aliquotaIva: number;
  periodicitaIva: PeriodicitaIva;
  maggiorazioneTrimestrale: number;

  scaglioniIrpef: ScaglioneIrpef[];
  addizionaleRegionale: number;
  addizionaleComunale: number;
  detrazioniPersonali: number;
  fondoPensione: number;

  gestione: Gestione;
  aliquotaGestioneSeparata: number;
  massimaleGs: number;
  minimaleGs: number;
  contributiFissi: number;
  minimaleArtigiani: number;
  aliquotaEccedenza: number;
  aliquotaSoggettivaCassa: number;
  aliquotaIntegrativaCassa: number;

  rivalsaAttiva: boolean;
  aliquotaRivalsa: number;
  ritenutaAttiva: boolean;
  aliquotaRitenuta: number;
  importoBollo: number;
  sogliaBollo: number;
  bolloAddebitato: boolean;
  terminiPagamento: number;

  giorniLavorativi: number;
  oreFatturabiliGiorno: number;
  /**
   * `null` finché non la si dichiara.
   *
   * Questi tre campi non hanno un valore ragionevole da indovinare: la tariffa
   * di un idraulico e quella di un avvocato non si somigliano, il netto voluto
   * è un desiderio e i costi fissi li conosce solo chi li paga. Un numero
   * plausibile scritto qui dall'app verrebbe lasciato lì, e da quel momento il
   * punto di pareggio e il fatturato necessario sarebbero costruiti su
   * un'invenzione senza che nessuno se ne accorga.
   */
  tariffaOraria: number | null;

  nettoDesiderato: number | null;
  percentualeAccantonamento: number;
  mesiFondoEmergenza: number;
  costiFissiAnnui: number | null;
};

/** Fattura come sta nel database: solo campi inseriti, mai derivati. */
export type Fattura = {
  id: string;
  dataEmissione: string;
  numero: string;
  clienteId: string;
  descrizione: string;
  tipoRicavo: TipoRicavo;
  imponibile: number;
  /** Aliquota IVA della singola operazione: 0 in forfettario, o esente/fuori campo. */
  aliquotaIva?: number;
  dataIncasso?: string | null;
};

/**
 * Nota di credito emessa: uno storno, non una fattura col meno davanti.
 *
 * È un documento a sé perché a sé lo tratta il fisco — ha una numerazione
 * propria, riduce il volume d'affari e l'IVA a debito — e perché un imponibile
 * negativo dentro `Fattura` si sarebbe infilato in ogni somma, ogni filtro e
 * ogni grafico scritti finora, dove nessuno lo aspetta.
 *
 * `imponibile` è **positivo**: il segno lo dà il tipo di documento, non il
 * numero. Chi scrive «-500» nel modulo intende cinquecento di storno, e
 * conservarlo negativo aprirebbe la porta alla doppia negazione — il difetto
 * che qui produce un totale plausibile e sbagliato.
 */
export type NotaCredito = {
  id: string;
  /** Comanda sull'IVA: il debito si riduce alla data del documento. */
  dataDocumento: string;
  numero: string;
  clienteId: string;
  descrizione: string;
  /** Sempre positivo. Lo storno che rappresenta. */
  imponibile: number;
  aliquotaIva?: number;
  /**
   * Quando il denaro torna indietro davvero, o si compensa. Comanda sui ricavi
   * per cassa, esattamente come `dataIncasso` su una fattura. `null` finché non
   * è avvenuto: la nota esiste e riduce l'IVA, ma non ha ancora ridotto incassi.
   */
  dataRimborso?: string | null;
  /**
   * A quali fatture si riferisce, e per quanto.
   *
   * Più di una perché uno storno può coprire due mesi di retainer: senza questo
   * si finisce per spezzare la nota in due note finte pur di farla stare, cioè
   * si sporcano i dati per aggirare il vincolo. Il residuo — di qua e di là —
   * non si salva, si calcola.
   */
  riconciliazioni?: { fatturaId: string; imponibile: number }[];
};

/** Costo come sta nel database. */
export type Costo = {
  id: string;
  dataDocumento: string;
  fornitore: string;
  categoria: string;
  descrizione: string;
  natura: NaturaCosto;
  imponibile: number;
  aliquotaIva: number;
  percentualeDeducibilita: number;
  /** Auto 40%, telefonia 50%, ristoranti 75%: l'Excel forzava 100%. */
  percentualeDetraibilitaIva?: number;
  dataPagamento?: string | null;
};

export type VersamentoF24 = {
  id: string;
  data: string;
  tipo: TipoVersamento;
  importo: number;
};

/** Fattura con i campi derivati calcolati. Non si salva mai così. */
export type FatturaCalcolata = Fattura & {
  aliquotaIvaApplicata: number;
  iva: number;
  rivalsa: number;
  integrativaCassa: number;
  bollo: number;
  bolloACarico: number;
  ritenuta: number;
  totale: number;
  nettoIncasso: number;
  /** Imponibile + rivalsa: la quota che concorre a formare il reddito. */
  ricavoRilevante: number;
  scadenza: string;
  stato: "incassato" | "daIncassare" | "scaduto";
  giorniIncasso: number | null;
  giorniRitardo: number;
};

export type CostoCalcolato = Costo & {
  iva: number;
  totale: number;
  costoDeducibile: number;
  ivaDetraibile: number;
  /** Uscita di cassa che resta davvero a carico, al netto dell'IVA recuperabile. */
  costoNetto: number;
  stato: "pagato" | "daPagare";
};
