/**
 * La tabella delle scorciatoie.
 *
 * È dichiarata una volta e letta da due posti: il gestore dei tasti, che la usa
 * per decidere cosa fare, e la schermata `/scorciatoie`, che la mostra. Una
 * scorciatoia che funziona ma non è documentata, o documentata ma non funziona,
 * è il difetto tipico di questa funzione: qui non può capitare.
 */
import { DESTINAZIONI } from "./vocabolario";

export type Scorciatoia = {
  /** I tasti come vanno letti: `["⌘", "K"]`, `["G", "F"]`. */
  tasti: string[];
  descrizione: string;
  /** Perché è utile, quando non è evidente dal nome. */
  nota?: string;
  /** Vale anche mentre si scrive in un campo. */
  dentroICampi?: boolean;
};

export type GruppoScorciatoie = { titolo: string; voci: Scorciatoia[] };

export const GRUPPI_SCORCIATOIE: GruppoScorciatoie[] = [
  {
    titolo: "Ovunque",
    voci: [
      {
        tasti: ["⌘", "K"],
        descrizione: "Apre la palette dei comandi",
        nota: "Ctrl K su Windows e Linux. Funziona anche mentre si scrive.",
        dentroICampi: true,
      },
      {
        tasti: ["/"],
        descrizione: "Cerca",
        nota: "Va nel campo di ricerca della schermata, se c'è; altrimenti apre la palette.",
      },
      { tasti: ["N"], descrizione: "Nuova fattura" },
      {
        tasti: ["?"],
        descrizione: "Questa schermata",
      },
      {
        tasti: ["Esc"],
        descrizione: "Chiude la palette o la finestra aperta",
        dentroICampi: true,
      },
    ],
  },
  {
    titolo: "Navigazione",
    voci: [
      {
        tasti: ["G", "poi una lettera"],
        descrizione: "Va a una schermata",
        nota: "Le lettere sono qui sotto. Si hanno due secondi per premere la seconda.",
      },
      ...DESTINAZIONI.filter((d) => d.pronta && d.tasto).map((d) => ({
        tasti: ["G", d.tasto!.toUpperCase()],
        descrizione: d.etichetta,
      })),
    ],
  },
  {
    titolo: "Nella palette",
    voci: [
      { tasti: ["↑", "↓"], descrizione: "Scorre i risultati", dentroICampi: true },
      { tasti: ["Invio"], descrizione: "Esegue il comando selezionato", dentroICampi: true },
      {
        tasti: ["Esc"],
        descrizione: "Chiude senza fare niente",
        dentroICampi: true,
      },
    ],
  },
];

/** `{ f: "/fatture", o: "/costi", … }`, per il gestore della sequenza `g`. */
export const ROTTE_PER_TASTO: Record<string, string> = Object.fromEntries(
  DESTINAZIONI.filter((d) => d.pronta && d.tasto).map((d) => [d.tasto!, d.href]),
);
