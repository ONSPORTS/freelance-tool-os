import {
  BarChart3,
  CalendarClock,
  Coins,
  Database,
  FileText,
  LayoutDashboard,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Voce = {
  href: string;
  etichetta: string;
  icona: LucideIcon;
  /** Le schermate delle fasi successive restano visibili ma inattive. */
  pronta: boolean;
  /** Nascosta quando il regime è forfettario. */
  soloOrdinario?: boolean;
};

export const GRUPPI: { titolo: string; voci: Voce[] }[] = [
  {
    titolo: "Ogni giorno",
    voci: [
      { href: "/", etichetta: "Cruscotto", icona: LayoutDashboard, pronta: true },
      { href: "/fatture", etichetta: "Fatture", icona: FileText, pronta: true },
      { href: "/costi", etichetta: "Costi", icona: Receipt, pronta: true },
      { href: "/clienti", etichetta: "Clienti", icona: Users, pronta: false },
    ],
  },
  {
    titolo: "Fisco",
    voci: [
      { href: "/fisco", etichetta: "Imposte e contributi", icona: Percent, pronta: false },
      { href: "/iva", etichetta: "IVA", icona: Coins, pronta: false, soloOrdinario: true },
      { href: "/confronto", etichetta: "Confronto regimi", icona: Scale, pronta: false },
      { href: "/scadenzario", etichetta: "Scadenzario", icona: CalendarClock, pronta: false },
    ],
  },
  {
    titolo: "Finanza",
    voci: [
      { href: "/cashflow", etichetta: "Cashflow", icona: BarChart3, pronta: false },
      { href: "/patrimonio", etichetta: "Patrimonio", icona: PiggyBank, pronta: false },
      { href: "/pianificazione", etichetta: "Pianificazione", icona: Target, pronta: false },
    ],
  },
  {
    titolo: "Impostazioni",
    voci: [
      { href: "/impostazioni", etichetta: "Parametri", icona: Settings, pronta: false },
      { href: "/dati", etichetta: "Dati e backup", icona: Database, pronta: true },
    ],
  },
];
