/**
 * A seeded PRNG (mulberry32). `Math.random` cannot be seeded, and this demo
 * needs the same book on every machine and every reload - otherwise the numbers
 * in a screenshot would never match the numbers on the site.
 */
export function createRandom(seed) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /** Integer in [min, max). */
  next.int = (min, max) => min + Math.floor(next() * (max - min));

  next.pick = (items) => items[next.int(0, items.length)];

  /** Picks by weight; `weights` runs parallel to `items`. */
  next.weighted = (items, weights) => {
    const total = weights.reduce((sum, w) => sum + w, 0);
    let target = next() * total;
    for (let i = 0; i < items.length; i++) {
      target -= weights[i];
      if (target <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  /** Standard normal via Box-Muller - the basis for log-normal stake sizes. */
  next.normal = () => {
    const u1 = 1 - next();
    const u2 = 1 - next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  next.shuffle = (items) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = next.int(0, i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  };

  return next;
}
