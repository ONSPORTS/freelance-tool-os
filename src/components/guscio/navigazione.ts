import {
  BarChart3,
  CalendarClock,
  Coins,
  CalendarCheck,
  Database,
  FileText,
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

export type Voce = {
  href: string;
  etichetta: string;
  icona: LucideIcon;
  /** Le schermate delle fasi successive restano visibili ma inattive. */
  pronta: boolean;
};

export const GRUPPI: { titolo: string; voci: Voce[] }[] = [
  {
    titolo: "Ogni giorno",
    voci: [
      { href: "/", etichetta: "Cruscotto", icona: LayoutDashboard, pronta: true },
      { href: "/fatture", etichetta: "Fatture", icona: FileText, pronta: true },
      { href: "/costi", etichetta: "Costi", icona: Receipt, pronta: true },
      { href: "/clienti", etichetta: "Clienti", icona: Users, pronta: true },
    ],
  },
  {
    titolo: "Fisco",
    voci: [
      { href: "/fisco", etichetta: "Imposte e contributi", icona: Percent, pronta: true },
      { href: "/iva", etichetta: "IVA", icona: Coins, pronta: true },
      { href: "/confronto", etichetta: "Confronto regimi", icona: Scale, pronta: true },
      { href: "/scadenzario", etichetta: "Scadenzario", icona: CalendarClock, pronta: true },
      { href: "/chiusura", etichetta: "Chiusura d'anno", icona: CalendarCheck, pronta: true },
    ],
  },
  {
    titolo: "Finanza",
    voci: [
      { href: "/cashflow", etichetta: "Cashflow", icona: BarChart3, pronta: true },
      { href: "/patrimonio", etichetta: "Patrimonio", icona: PiggyBank, pronta: true },
      { href: "/pianificazione", etichetta: "Pianificazione", icona: Target, pronta: true },
    ],
  },
  {
    titolo: "Impostazioni",
    voci: [
      { href: "/avvio", etichetta: "Configurazione", icona: Compass, pronta: true },
      { href: "/impostazioni", etichetta: "Parametri", icona: Settings, pronta: false },
      { href: "/dati", etichetta: "Dati e backup", icona: Database, pronta: true },
    ],
  },
];
