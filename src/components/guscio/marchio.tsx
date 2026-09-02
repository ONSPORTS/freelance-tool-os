/**
 * Il segno di Flowlance.
 *
 * Una «F» geometrica su tessera scura, con la barra centrale in accento: si
 * legge a 16 px nella scheda del browser e a 32 nella barra laterale, che sono
 * le due sole misure in cui compare davvero. Il file `src/app/icon.svg` è lo
 * stesso disegno: se cambia uno, cambia anche l'altro.
 *
 * Prima qui c'era l'icona «portafoglio» presa dalla libreria, e nella scheda
 * del browser era rimasta la favicon predefinita del framework: due segni
 * altrui al posto di quello dell'applicazione.
 */
export function SegnoFlowlance({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="Flowlance" className={className}>
      <rect width="32" height="32" rx="8" fill="#141A33" />
      <rect x="9" y="8" width="4" height="16" rx="1.2" fill="#FFFFFF" />
      <rect x="9" y="8" width="14" height="4" rx="1.2" fill="#FFFFFF" />
      <rect x="9" y="15" width="10" height="4" rx="1.2" fill="#4C5BF5" />
    </svg>
  );
}
