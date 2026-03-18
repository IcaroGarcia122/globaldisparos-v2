export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Delay aleatório entre min e max ms — anti-ban */
export const randomDelay = (minMs: number, maxMs: number) =>
  delay(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
