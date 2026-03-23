"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomDelay = exports.delay = void 0;
const delay = (ms) => new Promise(r => setTimeout(r, ms));
exports.delay = delay;
/** Delay aleatório entre min e max ms — anti-ban */
const randomDelay = (minMs, maxMs) => (0, exports.delay)(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
exports.randomDelay = randomDelay;
//# sourceMappingURL=delay.js.map