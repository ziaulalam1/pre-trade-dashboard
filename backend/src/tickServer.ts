/**
 * WebSocket tick server — emits simulated price ticks at a configurable interval.
 *
 * Generates a geometric Brownian motion random walk around a base price.
 * Clients receive JSON messages: { symbol, price, timestamp }
 *
 * Usage:
 *   ts-node src/tickServer.ts                    # default: AAPL @ $100, 500ms
 *   ts-node src/tickServer.ts --symbol SPY --interval 250
 */

import { WebSocketServer, WebSocket } from "ws";

const PORT = parseInt(process.env.TICK_PORT || "3002", 10);
const SYMBOL = process.env.TICK_SYMBOL || "AAPL";
const INTERVAL_MS = parseInt(process.env.TICK_INTERVAL || "500", 10);
const BASE_PRICE = parseFloat(process.env.TICK_BASE || "100");

// Geometric Brownian Motion parameters
const MU = 0.0;       // drift (annualized) — 0 for neutral
const SIGMA = 0.2;    // volatility (annualized) — 20%
const DT = INTERVAL_MS / (252 * 6.5 * 3600 * 1000); // fraction of a trading year

let currentPrice = BASE_PRICE;

function nextTick(): number {
  const drift = (MU - 0.5 * SIGMA * SIGMA) * DT;
  const diffusion = SIGMA * Math.sqrt(DT) * gaussianRandom();
  currentPrice *= Math.exp(drift + diffusion);
  return Math.round(currentPrice * 100) / 100;
}

function gaussianRandom(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const wss = new WebSocketServer({ port: PORT });

console.log(`Tick server started on ws://localhost:${PORT}`);
console.log(`  Symbol: ${SYMBOL}, Base: $${BASE_PRICE}, Interval: ${INTERVAL_MS}ms`);

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`Client connected (${clients.size} active)`);

  // send current price immediately on connect
  ws.send(JSON.stringify({
    symbol: SYMBOL,
    price: currentPrice,
    timestamp: new Date().toISOString(),
  }));

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`Client disconnected (${clients.size} active)`);
  });
});

setInterval(() => {
  const price = nextTick();
  const msg = JSON.stringify({
    symbol: SYMBOL,
    price,
    timestamp: new Date().toISOString(),
  });

  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}, INTERVAL_MS);
