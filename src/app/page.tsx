import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-etichetta text-inchiostro-tenue">Freelance Finance OS</p>
        <h1 className="mt-2 font-display text-semaforo font-semibold tracking-tight">
          Di questi soldi, quanti sono davvero miei?
        </h1>
        <p className="mt-3 max-w-lg text-corpo text-inchiostro-tenue">
          Fondamenta e motore fiscale sono in piedi. Le schermate arrivano nelle fasi
          successive: qui sotto trovi il sistema visivo e la verifica del calcolo.
        </p>
      </div>
      <div>
        <Button asChild>
          <Link href="/design">Apri il sistema visivo</Link>
        </Button>
      </div>
    </main>
  );
}
