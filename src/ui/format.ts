/** Keep floating-point feed precision out of compact magnitude labels. Raw values stay in the model. */
export function magnitudeLabel(value: number | null): string {
  return value === null ? "?" : String(Number(value.toFixed(2)));
}
