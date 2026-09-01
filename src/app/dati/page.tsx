import { SoloClient } from "@/components/ui/solo-client";
import { PannelloDati } from "./pannello-dati";

export const metadata = {
  title: "Dati e backup · Freelance Finance OS",
};

export default function PaginaDati() {
  return (
    <SoloClient
      segnaposto={
        <main className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-corpo text-inchiostro-tenue">Apertura dell&apos;archivio locale…</p>
        </main>
      }
    >
      <PannelloDati />
    </SoloClient>
  );
}
