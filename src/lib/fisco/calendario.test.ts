import { describe, expect, it } from "vitest";
import { eFestivo, festivita, giorniAllaData, pasqua, slittaAGiornoLavorativo } from "./calendario";

describe("calendario civile", () => {
  it("calcola la domenica di Pasqua", () => {
    expect(pasqua(2024)).toBe("2024-03-31");
    expect(pasqua(2025)).toBe("2025-04-20");
    expect(pasqua(2026)).toBe("2026-04-05");
    expect(pasqua(2027)).toBe("2027-03-28");
    expect(pasqua(2030)).toBe("2030-04-21");
  });

  it("include il lunedì dell'Angelo fra le festività", () => {
    expect(festivita(2026).has("2026-04-06")).toBe(true);
    expect(festivita(2026).has("2026-12-25")).toBe(true);
    expect(festivita(2026).has("2026-06-02")).toBe(true);
    expect(festivita(2026).has("2026-07-15")).toBe(false);
  });

  it("riconosce sabati, domeniche e festivi", () => {
    expect(eFestivo("2026-08-15")).toBe(true); // Ferragosto, di sabato
    expect(eFestivo("2026-08-16")).toBe(true); // domenica
    expect(eFestivo("2026-08-17")).toBe(false); // lunedì
    expect(eFestivo("2026-04-06")).toBe(true); // lunedì dell'Angelo
  });

  it("sposta le scadenze al primo giorno lavorativo utile", () => {
    // Il 16 agosto 2026 è domenica, e il 15 è Ferragosto di sabato.
    expect(slittaAGiornoLavorativo("2026-08-16")).toBe("2026-08-17");
    // Il 1° novembre 2026 è domenica e festivo.
    expect(slittaAGiornoLavorativo("2026-11-01")).toBe("2026-11-02");
    // Un giorno lavorativo resta dov'è.
    expect(slittaAGiornoLavorativo("2026-06-30")).toBe("2026-06-30");
  });

  it("conta i giorni che mancano, con segno", () => {
    expect(giorniAllaData("2026-09-30", "2026-09-01")).toBe(29);
    expect(giorniAllaData("2026-08-20", "2026-09-01")).toBe(-12);
    expect(giorniAllaData("2026-09-01", "2026-09-01")).toBe(0);
  });
});
