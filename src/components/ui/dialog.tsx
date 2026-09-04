"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { titolo: string; descrizione?: string }
>(({ className, children, titolo, descrizione, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-inchiostro/25 backdrop-blur-[2px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
        // Un modulo più alto dello schermo, centrato e in posizione fissa, esce
        // dalla finestra da tutt'e due i lati e non si scorre: su un iPhone SE
        // il pulsante «Crea la fattura» stava sotto il bordo e non c'era modo
        // di raggiungerlo. Il tetto d'altezza e lo scorrimento interno lo
        // rimettono in campo; `overscroll-contain` evita che lo scorrimento
        // arrivato in fondo trascini la pagina sotto.
        "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain",
        "rounded-card bg-superficie p-4 shadow-sollevato focus:outline-none sm:p-6",
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <DialogPrimitive.Title className="font-display text-kpi-sm font-semibold">
            {titolo}
          </DialogPrimitive.Title>
          {descrizione && (
            <DialogPrimitive.Description className="mt-1 text-etichetta text-inchiostro-tenue">
              {descrizione}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          aria-label="Chiudi"
          className="rounded-campo p-1 text-inchiostro-tenue transition-colors hover:bg-superficie-alt hover:text-inchiostro"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </div>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
