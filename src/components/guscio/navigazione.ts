import {
  BarChart3,
  CalendarClock,
  Coins,
  CalendarCheck,
  Database,
  FileText,
  Keyboard,
  LayoutDashboard,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  Compass,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DESTINAZIONI, type Destinazione } from "@/lib/comandi/vocabolario";

export type Voce = Destinazione & { icona: LucideIcon };

/**
 * Le rotte vivono in `lib/comandi/vocabolario`, che è puro; qui si aggiungono
 * soltanto le icone. La barra laterale e la palette leggono così lo stesso
 * elenco: una schermata nuova compare in entrambe, o in nessuna delle due.
 */
const ICONE: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/fatture": FileText,
  "/costi": Receipt,
  "/clienti": Users,
  "/fisco": Percent,
  "/iva": Coins,
  "/confronto": Scale,
  "/scadenzario": CalendarClock,
  "/chiusura": CalendarCheck,
  "/cashflow": BarChart3,
  "/patrimonio": PiggyBank,
  "/pianificazione": Target,
  "/avvio": Compass,
  "/impostazioni": Settings,
  "/dati": Database,
  "/scorciatoie": Keyboard,
};

/** L'ordine dei gruppi nel menu, che non è quello alfabetico. */
const ORDINE = ["Ogni giorno", "Fisco", "Finanza", "Impostazioni"];

export const GRUPPI: { titolo: string; voci: Voce[] }[] = ORDINE.map((titolo) => ({
  titolo,
  voci: DESTINAZIONI.filter((d) => d.gruppo === titolo).map((d) => ({
    ...d,
    icona: ICONE[d.href] ?? FileText,
  })),
}));
