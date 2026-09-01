import Link from "next/link";

const TAPPE = [
  { href: "/fatture", titolo: "Fatture", nota: "Registro con modifica in linea, filtri, ordinamento e totali" },
  { href: "/costi", titolo: "Costi", nota: "Stesso registro, con categoria, natura e deducibilità" },
  { href: "/dati", titolo: "Dati e backup", nota: "Archivio locale, export e import JSON, dataset dimostrativo" },
  { href: "/design", titolo: "Sistema visivo", nota: "Token, tipografia, componenti e semaforo fiscale" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-etichetta text-inchiostro-tenue">Freelance Finance OS</p>
        <h1 className="mt-2 font-display text-semaforo font-semibold tracking-tight">
          Di questi soldi, quanti sono davvero miei?
        </h1>
        <p className="mt-3 max-w-lg text-corpo text-inchiostro-tenue">
          Fondamenta, motore fiscale, archivio locale e i due registri di lavoro
          quotidiano sono in piedi. Dashboard e prospetti arrivano nelle fasi successive.
        </p>
      </div>
      <nav className="flex flex-col gap-2">
        {TAPPE.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-interna bg-superficie p-4 shadow-riposo transition-shadow duration-200 ease-quieto hover:shadow-sollevato"
          >
            <span className="block text-corpo font-medium">{t.titolo}</span>
            <span className="block text-etichetta text-inchiostro-tenue">{t.nota}</span>
          </Link>
        ))}
      </nav>
      <p className="max-w-lg text-etichetta text-inchiostro-tenue">
        Strumento gestionale di pianificazione: produce stime, non dichiarazioni. Non
        considera altri redditi che in regime ordinario concorrono al reddito complessivo
        e possono spostare lo scaglione IRPEF.
      </p>
    </main>
  );
}
