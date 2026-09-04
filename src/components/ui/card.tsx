import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card contenitore: raggio 24, ombra a riposo. Non si solleva all'hover —
 * il sollevamento è riservato a ciò che si può cliccare davvero.
 */
export function Card({
  className,
  scura = false,
  cliccabile = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scura?: boolean; cliccabile?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-card shadow-riposo",
        scura ? "bg-inchiostro text-white" : "bg-superficie",
        cliccabile &&
          "cursor-pointer transition-shadow duration-200 ease-quieto hover:shadow-sollevato",
        className,
      )}
      {...props}
    />
  );
}

/** Card annidata dentro una card contenitore: raggio 16, nessuna ombra. */
export function CardInterna({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-interna"
      className={cn("rounded-interna bg-superficie-alt", className)}
      {...props}
    />
  );
}

export function CardIntestazione({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-intestazione"
      // Titolo e sottotitolo affiancati, su 320 px, danno una colonna da una
      // parola per riga: «1 · Scegli / il file» impilato in verticale. Sul
      // telefono si mettono uno sotto l'altro, che è come si leggono comunque.
      className={cn(
        "flex flex-col items-start gap-2 px-4 pt-5 sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:pt-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitolo({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="card-titolo"
      className={cn("font-display text-kpi-sm font-semibold text-inchiostro", className)}
      {...props}
    />
  );
}

export function CardSottotitolo({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-sottotitolo"
      className={cn("text-etichetta text-inchiostro-tenue", className)}
      {...props}
    />
  );
}

export function CardCorpo({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-corpo" className={cn("p-4 sm:p-6", className)} {...props} />;
}
