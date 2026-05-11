// Calculadoras ecográficas. Funciones puras — sin estado, sin React — para
// que el formulario las llame en cada keystroke sin sorpresas y los tests
// puedan ejercer los rangos clínicamente plausibles sin levantar un DOM.

export function isPositiveNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

// Volumen ovárico por elipsoide prolato. Tres dimensiones en mm; el resultado
// en ml es: 0.523 × L × A × AP / 1000  (mm³ → ml).
// La constante 0.523 ≈ π/6 que aparece en la literatura ginecológica
// (Sample, Lyons, Cooperberg) y es la convención que el ecógrafo del doctor
// también usa, así que conviene reproducir bit-exact.
export function ovaryVolumeMl(
  lengthMm: number | null | undefined,
  widthMm: number | null | undefined,
  apMm: number | null | undefined,
): number | null {
  if (!isPositiveNumber(lengthMm) || !isPositiveNumber(widthMm) || !isPositiveNumber(apMm)) {
    return null;
  }
  const ml = (0.523 * lengthMm * widthMm * apMm) / 1000;
  return Number(ml.toFixed(2));
}

// Peso fetal estimado — Hadlock IV (la más usada cuando hay las cuatro
// medidas). Todas las dimensiones se reciben en mm y se convierten a cm
// porque la fórmula original está expresada en cm.
//
//   log10(EFW) = 1.3596
//              − 0.00386 × AC × FL
//              + 0.0064  × HC
//              + 0.00061 × BPD × AC
//              + 0.0424  × AC
//              + 0.174   × FL
//
// EFW en gramos. La salida se redondea al gramo entero — la precisión real
// del método es ±15 % así que mostrar decimales solo sugiere una exactitud
// que no existe.
export function hadlockEfwGrams(
  bpdMm: number | null | undefined,
  hcMm: number | null | undefined,
  acMm: number | null | undefined,
  flMm: number | null | undefined,
): number | null {
  if (
    !isPositiveNumber(bpdMm) ||
    !isPositiveNumber(hcMm) ||
    !isPositiveNumber(acMm) ||
    !isPositiveNumber(flMm)
  ) {
    return null;
  }
  const bpd = bpdMm / 10;
  const hc = hcMm / 10;
  const ac = acMm / 10;
  const fl = flMm / 10;

  const logEfw =
    1.3596 -
    0.00386 * ac * fl +
    0.0064 * hc +
    0.00061 * bpd * ac +
    0.0424 * ac +
    0.174 * fl;

  const efw = Math.pow(10, logEfw);
  if (!Number.isFinite(efw) || efw <= 0) return null;
  return Math.round(efw);
}

// Edad gestacional por biometría. Cuando hay varias medidas se promedia para
// reducir el sesgo de una sola — es lo que hace el propio ecógrafo cuando
// muestra "EG promedio biometrías".
//
// Las fórmulas son ajustes polinómicos publicados (Hadlock 1984):
//   GA(BPD)  = 9.54  + 1.482 · BPD  + 0.1676 · BPD²       (BPD en cm)
//   GA(FL)   = 10.35 + 2.460 · FL   + 0.170  · FL²        (FL en cm)
//   GA(AC)   = 8.14  + 0.753 · AC   + 0.0036 · AC²        (AC en cm)
//   GA(HC)   = 8.96  + 0.540 · HC   + 0.0003 · HC²        (HC en cm)
//
// El resultado se entrega en semanas decimales (ej: 24.3 → 24w + ~2d) con
// una decimal — la incertidumbre real del método supera el día.
export function gestationalAgeWeeks(
  bpdMm: number | null | undefined,
  hcMm: number | null | undefined,
  acMm: number | null | undefined,
  flMm: number | null | undefined,
): number | null {
  const estimates: number[] = [];

  if (isPositiveNumber(bpdMm)) {
    const bpd = bpdMm / 10;
    estimates.push(9.54 + 1.482 * bpd + 0.1676 * bpd * bpd);
  }
  if (isPositiveNumber(flMm)) {
    const fl = flMm / 10;
    estimates.push(10.35 + 2.46 * fl + 0.17 * fl * fl);
  }
  if (isPositiveNumber(acMm)) {
    const ac = acMm / 10;
    estimates.push(8.14 + 0.753 * ac + 0.0036 * ac * ac);
  }
  if (isPositiveNumber(hcMm)) {
    const hc = hcMm / 10;
    estimates.push(8.96 + 0.54 * hc + 0.0003 * hc * hc);
  }

  if (estimates.length === 0) return null;
  const avg = estimates.reduce((a, b) => a + b, 0) / estimates.length;
  if (!Number.isFinite(avg) || avg <= 0) return null;
  return Number(avg.toFixed(1));
}
