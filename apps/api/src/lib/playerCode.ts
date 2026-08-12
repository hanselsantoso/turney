/* Player code: short human-readable id staff use for on-spot registration.
   Shape: first 3 letters of display name (A-Z, padded with X) + 4 digits. */
export function makePlayerCode(displayName: string) {
  const stem = displayName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .padEnd(3, "X")
    .slice(0, 3);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${stem}-${num}`;
}
