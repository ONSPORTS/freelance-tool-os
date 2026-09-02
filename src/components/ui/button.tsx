"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useSolaLettura } from "@/lib/stato/licenza";

const bottone = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-campo font-medium " +
    "transition-[background-color,border-color,color,box-shadow] duration-150 ease-quieto " +
    "disabled:pointer-events-none disabled:opacity-45 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variante: {
        primario: "bg-accento text-white hover:bg-[#3D4CE8] active:bg-[#3341D6]",
        contorno:
          "border border-bordo bg-superficie text-inchiostro hover:bg-superficie-alt hover:border-[#D5DBE7]",
        quieto: "text-inchiostro-tenue hover:bg-superficie-alt hover:text-inchiostro",
        scuro: "bg-inchiostro text-white hover:bg-[#1B2247]",
        pericolo: "bg-negativo text-white hover:bg-[#D13A3F]",
      },
      taglia: {
        sm: "h-8 px-3 text-etichetta",
        md: "h-10 px-4 text-corpo",
        lg: "h-11 px-5 text-corpo",
        icona: "size-9 p-0",
      },
    },
    defaultVariants: { variante: "primario", taglia: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof bottone> {
  asChild?: boolean;
  /**
   * Il pulsante scrive nell'archivio.
   *
   * A licenza scaduta si spegne da solo, con la spiegazione nel `title`.
   * Marcarlo è una parola sola sul posto e si trova con un grep — molto meno
   * dimenticabile di una condizione riscritta a mano a ogni chiamata. I
   * pulsanti che leggono (esportare, filtrare, navigare) restano vivi sempre:
   * a licenza scaduta si consulta tutto.
   */
  scrive?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variante, taglia, asChild = false, scrive = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const bloccato = useSolaLettura();
    const spento = scrive && bloccato;
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(bottone({ variante, taglia }), className)}
        {...props}
        {...(spento
          ? {
              disabled: true,
              "aria-disabled": true,
              // Anche l'`onClick`, non solo `disabled`: con `asChild` il figlio
              // può essere un link, che `disabled` non ferma.
              onClick: undefined,
              title: "Licenza scaduta: l'app è in sola lettura.",
            }
          : null)}
      />
    );
  },
);
Button.displayName = "Button";

export { bottone as varianteBottone };
