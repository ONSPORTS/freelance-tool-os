import type { ParametriAnno } from "../tipi";

/**
 * Parametri fiscali e previdenziali 2026.
 *
 * Aliquote, soglie e minimali cambiano ogni anno con la Legge di Bilancio e le
 * circolari INPS. Questo file è l'unico punto da toccare a gennaio: nessun
 * valore di legge è scritto altrove nel codice.
 */
export const PARAMETRI_2026: ParametriAnno = {
  anno: 2026,
  fonti: [
    "Legge di Bilancio 2026",
    "Allegato n. 2 alla Legge 190/2014 — coefficienti di redditività",
    "Circolare INPS n. 8 del 3 febbraio 2026 — aliquote previdenziali",
  ],

  limiteForfettario: 85_000,
  sogliaUscitaImmediata: 100_000,
  sogliaAvviso: 0.85,
  aliquotaSostitutiva: 0.15,
  aliquotaSostitutivaNuovaAttivita: 0.05,
  anniNuovaAttivita: 5,

  gruppiAteco: [
    {
      codice: "professionali",
      descrizione:
        "Attività professionali, scientifiche, tecniche, sanitarie, di istruzione, servizi finanziari e assicurativi",
      coefficiente: 0.78,
    },
    {
      codice: "altre",
      descrizione: "Altre attività economiche (servizi non altrimenti classificati)",
      coefficiente: 0.67,
    },
    { codice: "costruzioni", descrizione: "Costruzioni e attività immobiliari", coefficiente: 0.86 },
    { codice: "intermediari", descrizione: "Intermediari del commercio", coefficiente: 0.62 },
    {
      codice: "commercio",
      descrizione: "Commercio all'ingrosso e al dettaglio",
      coefficiente: 0.4,
    },
    {
      codice: "ambulanteAlimentari",
      descrizione: "Commercio ambulante di prodotti alimentari e bevande",
      coefficiente: 0.4,
    },
    {
      codice: "ambulanteAltri",
      descrizione: "Commercio ambulante di altri prodotti",
      coefficiente: 0.54,
    },
    {
      codice: "alimentari",
      descrizione: "Industrie alimentari e delle bevande",
      coefficiente: 0.4,
    },
    {
      codice: "ristorazione",
      descrizione: "Servizi di alloggio e ristorazione",
      coefficiente: 0.4,
    },
  ],

  scaglioniIrpef: [
    { limite: 28_000, aliquota: 0.23 },
    { limite: 50_000, aliquota: 0.33 },
    { limite: null, aliquota: 0.43 },
  ],
  tettoFondoPensione: 5_164.57,

  aliquotaGestioneSeparata: 0.2607,
  massimaleGestioneSeparata: 122_295,
  minimaleAccreditoGestioneSeparata: 18_808,
  minimaleArtigiani: 18_555,
  aliquotaEccedenzaArtigiani: 0.2448,

  aliquotaIvaOrdinaria: 0.22,
  maggiorazioneTrimestrale: 0.01,
  // Il saldo del quarto trimestre confluisce nella dichiarazione annuale
  // e non sconta la maggiorazione dell'1%.
  maggiorazioneSuQuartoTrimestre: false,

  aliquotaRivalsaInps: 0.04,
  aliquotaRitenuta: 0.2,
  importoBollo: 2,
  sogliaBollo: 77.47,

  sogliaAcconti: 51.65,
  sogliaAccontoUnico: 257.52,
  quotaPrimoAcconto: 0.4,
  quotaSecondoAcconto: 0.6,
  rateRateizzazione: 6,
  interesseRateizzazioneMensile: 0.0033,
};
