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
      className={cn("flex items-start justify-between gap-4 px-4 pt-5 sm:px-6 sm:pt-6", className)}
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
