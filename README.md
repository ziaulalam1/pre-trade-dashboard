# Pre-Trade Analytics Dashboard

Options pricing engine with Black-Scholes Greeks, scenario analysis, and P&L attribution. React frontend runs entirely client-side -- no backend required.

**[Live demo](https://ziaulalam1.github.io/dashboard/)**

## The Problem

Options pricing libraries tend to get the common case right but produce wrong Greeks under edge conditions -- deep out-of-the-money, near-zero expiry, extreme volatility. These errors compound when you build scenario analysis or P&L attribution on top of them.

## How It Works

Instead of validating outputs against a textbook table (which only covers a handful of scenarios), the test suite verifies **put-call parity as a structural invariant** -- it must hold to 1e-10 for every combination of inputs. If parity breaks, the entire pricing model is wrong. This catches classes of bugs that example-based tests miss.

The Black-Scholes engine is embedded directly in the frontend (no API calls), so the demo runs as a static site.

### Panels

- **Option Chain Grid** -- price + delta across strike/expiry combinations
- **Scenario Analysis** -- baseline vs stressed parameters with Greeks comparison
- **P&L Attribution** -- decomposes price change into delta, gamma, and vega contributions

## Invariants

| Test | What it proves |
|------|---------------|
| Put-call parity | Holds to 1e-10 for every input combination |
| Greeks bounds | Delta in [-1, 1], gamma non-negative, vega non-negative |
| Edge conditions | Near-zero expiry and extreme vol produce finite, bounded outputs |

13 tests passing, 10 benchmark scenarios.

## Benchmark

100-option chain: **p50 = 0.004ms** | **p95 = 0.098ms** | max absolute error vs reference: **0.0045**

## Run It

```bash
cd backend && npm install && npm test    # 13/13 pass
npm run benchmark                        # reports/benchmark.json + benchmark.png

cd ../frontend && npm install && npm run dev   # localhost:5173
```

## Stack

TypeScript, React, Vite, Node.js, Black-Scholes (Abramowitz & Stegun normCDF approximation)
