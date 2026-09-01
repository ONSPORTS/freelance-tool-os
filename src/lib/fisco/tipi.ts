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
  tariffaOraria: number;

  nettoDesiderato: number;
  percentualeAccantonamento: number;
  mesiFondoEmergenza: number;
  costiFissiAnnui: number;
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
