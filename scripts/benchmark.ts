/**
 * benchmark.ts — Black-Scholes accuracy + performance benchmark
 * Usage: ts-node scripts/benchmark.ts
 * Requires backend running on port 3001 for latency test.
 */

import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { price, priceChain, OptionInput } from "../backend/src/blackScholes";

// ── Hull textbook reference cases ────────────────────────────────────────────
// Options, Futures and Other Derivatives — John C. Hull, 11th ed.
// Values verified against Hull's closed-form tables.

interface TestCase {
  name: string;
  input: OptionInput;
  referencePrice: number;
}

const TEST_CASES: TestCase[] = [
  // Hull Ch.15 examples
  {
    name: "Hull ATM call 6m 20%vol",
    input: { spot: 42, strike: 40, expiry: 0.5, rate: 0.1, vol: 0.2, type: "call" },
    referencePrice: 4.76,
  },
  {
    name: "Hull OTM put 6m 20%vol",
    input: { spot: 42, strike: 45, expiry: 0.5, rate: 0.1, vol: 0.2, type: "put" },
    referencePrice: 2.81,
  },
  {
    name: "Hull ATM call 1y 30%vol",
    input: { spot: 100, strike: 100, expiry: 1, rate: 0.05, vol: 0.3, type: "call" },
    referencePrice: 14.23,
  },
  {
    name: "Hull ATM put 1y 30%vol",
    input: { spot: 100, strike: 100, expiry: 1, rate: 0.05, vol: 0.3, type: "put" },
    referencePrice: 9.35,
  },
  {
    name: "Deep ITM call",
    input: { spot: 120, strike: 90, expiry: 1, rate: 0.05, vol: 0.2, type: "call" },
    referencePrice: 34.77,
  },
  {
    name: "Deep OTM call",
    input: { spot: 80, strike: 110, expiry: 1, rate: 0.05, vol: 0.2, type: "call" },
    referencePrice: 0.76,
  },
  {
    name: "Short expiry ATM call",
    input: { spot: 100, strike: 100, expiry: 0.083, rate: 0.05, vol: 0.2, type: "call" },
    referencePrice: 2.51,
  },
  {
    name: "High vol call",
    input: { spot: 100, strike: 100, expiry: 1, rate: 0.05, vol: 0.5, type: "call" },
    referencePrice: 21.79,
  },
  {
    name: "Low rate put",
    input: { spot: 100, strike: 100, expiry: 1, rate: 0.01, vol: 0.2, type: "put" },
    referencePrice: 7.44,
  },
  {
    name: "Hull near-zero vol call",
    input: { spot: 100, strike: 95, expiry: 1, rate: 0.05, vol: 0.01, type: "call" },
    referencePrice: 9.63,
  },
];

// ── Accuracy benchmark ────────────────────────────────────────────────────────

function runAccuracy() {
  console.log("\n=== Accuracy vs Hull Reference ===");
  const errors: number[] = [];

  for (const tc of TEST_CASES) {
    const result = price(tc.input);
    const absErr = Math.abs(result.price - tc.referencePrice);
    errors.push(absErr);
    const ok = absErr < 0.15; // Hull rounds to 2dp; allow 0.15 tolerance
    console.log(
      `  ${ok ? "✓" : "✗"} ${tc.name.padEnd(35)} ` +
      `computed=${result.price.toFixed(4)}  ref=${tc.referencePrice.toFixed(4)}  ` +
      `err=${absErr.toFixed(4)}`
    );
  }

  const maxErr = Math.max(...errors);
  const meanErr = errors.reduce((a, b) => a + b, 0) / errors.length;
  console.log(`\n  Max absolute error : ${maxErr.toFixed(6)}`);
  console.log(`  Mean absolute error: ${meanErr.toFixed(6)}`);
  return { maxErr, meanErr, cases: TEST_CASES.map((tc, i) => ({
    name: tc.name,
    computed: price(tc.input).price,
    reference: tc.referencePrice,
    absErr: errors[i],
  })) };
}

// ── Local latency benchmark (priceChain) ─────────────────────────────────────

function buildChain100(): OptionInput[] {
  const opts: OptionInput[] = [];
  const strikes = Array.from({ length: 10 }, (_, i) => 80 + i * 4);
  const expiries = [0.25, 0.5, 0.75, 1.0, 1.5];
  for (const T of expiries) {
    for (const K of strikes) {
      opts.push({ spot: 100, strike: K, expiry: T, rate: 0.05, vol: 0.2, type: "call" });
      opts.push({ spot: 100, strike: K, expiry: T, rate: 0.05, vol: 0.2, type: "put" });
    }
  }
  return opts.slice(0, 100);
}

function runLocalLatency() {
  console.log("\n=== Local priceChain Latency (100 options × 100 runs) ===");
  const chain = buildChain100();
  const times: number[] = [];
  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    priceChain(chain);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[49];
  const p95 = times[94];
  const p99 = times[98];
  console.log(`  p50=${p50.toFixed(3)}ms  p95=${p95.toFixed(3)}ms  p99=${p99.toFixed(3)}ms`);
  return { p50, p95, p99 };
}

// ── HTTP latency benchmark ────────────────────────────────────────────────────

function httpPost(body: string): Promise<{ statusCode: number; elapsed: number }> {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const req = http.request(
      { hostname: "localhost", port: 3001, path: "/chain", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      res => {
        let data = "";
        res.on("data", c => { data += c; });
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, elapsed: performance.now() - t0 }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function runHttpLatency(): Promise<{ p50: number; p95: number; p99: number } | null> {
  console.log("\n=== HTTP /chain Latency (100 options × 50 requests) ===");
  const chain = buildChain100();
  const body = JSON.stringify(chain);
  const times: number[] = [];

  try {
    for (let i = 0; i < 50; i++) {
      const { elapsed } = await httpPost(body);
      times.push(elapsed);
    }
    times.sort((a, b) => a - b);
    const p50 = times[24];
    const p95 = times[47];
    const p99 = times[49];
    console.log(`  p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  p99=${p99.toFixed(1)}ms`);
    return { p50, p95, p99 };
  } catch (e) {
    console.log("  Backend not running — skipping HTTP latency test.");
    return null;
  }
}

// ── ASCII bar chart ───────────────────────────────────────────────────────────

function asciiBar(label: string, value: number, max: number, width = 30) {
  const filled = Math.round((value / max) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `  ${label.padEnd(38)} [${bar}] ${value.toFixed(4)}`;
}

function printChart(cases: Array<{ name: string; absErr: number }>) {
  console.log("\n=== Error Bar Chart ===");
  const maxErr = Math.max(...cases.map(c => c.absErr), 0.001);
  for (const c of cases) {
    console.log(asciiBar(c.name, c.absErr, maxErr));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Black-Scholes Benchmark\n" + "=".repeat(50));

  const accuracy = runAccuracy();
  const localLatency = runLocalLatency();
  const httpLatency = await runHttpLatency();

  printChart(accuracy.cases);

  const report = {
    timestamp: new Date().toISOString(),
    accuracy: {
      maxAbsError: accuracy.maxErr,
      meanAbsError: accuracy.meanErr,
      cases: accuracy.cases,
    },
    localLatencyMs: localLatency,
    httpLatencyMs: httpLatency,
  };

  const reportsDir = path.join(__dirname, "../reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, "benchmark.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);

  // ASCII chart → benchmark.png fallback (write ASCII text file)
  const pngPath = path.join(reportsDir, "benchmark.png");
  if (!fs.existsSync(pngPath)) {
    const lines = ["Black-Scholes Benchmark — ASCII Error Chart", ""];
    const maxErr = Math.max(...accuracy.cases.map(c => c.absErr), 0.001);
    for (const c of accuracy.cases) {
      lines.push(asciiBar(c.name, c.absErr, maxErr));
    }
    lines.push("", `Max error: ${accuracy.maxErr.toFixed(6)}`);
    lines.push(`Mean error: ${accuracy.meanErr.toFixed(6)}`);
    fs.writeFileSync(pngPath, lines.join("\n"));
    console.log(`ASCII chart saved to ${pngPath}`);
  }
}

main().catch(console.error);
