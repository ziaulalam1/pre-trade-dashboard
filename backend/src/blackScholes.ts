// Black-Scholes closed-form pricing engine
// Supports European calls and puts; same model for all underlying types (equity, rate, index)

export type OptionType = "call" | "put";

export interface OptionInput {
  spot: number;     // S — current underlying price
  strike: number;   // K — strike price
  expiry: number;   // T — time to expiry in years
  rate: number;     // r — continuously compounded risk-free rate (e.g. 0.05 = 5%)
  vol: number;      // σ — annualised implied volatility (e.g. 0.2 = 20%)
  type: OptionType;
}

export interface OptionResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;  // per calendar day
  vega: number;   // per 1% move in vol
  rho: number;    // per 1% move in rate
}

// Standard normal CDF via rational approximation (Abramowitz & Stegun 26.2.17)
export function normCDF(x: number): number {
  if (x < -8) return 0;
  if (x >  8) return 1;
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// Standard normal PDF
function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function validateInput(opt: OptionInput): string | null {
  if (opt.spot   <= 0) return "spot must be > 0";
  if (opt.strike <= 0) return "strike must be > 0";
  if (opt.expiry <= 0) return "expiry must be > 0";
  if (opt.vol    <= 0) return "vol must be > 0";
  if (opt.type !== "call" && opt.type !== "put") return "type must be 'call' or 'put'";
  return null;
}

export function price(opt: OptionInput): OptionResult {
  const { spot: S, strike: K, expiry: T, rate: r, vol: σ, type } = opt;

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * σ * σ) * T) / (σ * sqrtT);
  const d2 = d1 - σ * sqrtT;
  const df = Math.exp(-r * T); // discount factor

  const Nd1  = normCDF(d1),  Nd2  = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);
  const nd1  = normPDF(d1);

  const isCall = type === "call";

  const p     = isCall ? S * Nd1 - K * df * Nd2 : K * df * Nnd2 - S * Nnd1;
  const delta = isCall ? Nd1 : Nd1 - 1;
  const gamma = nd1 / (S * σ * sqrtT);
  // Theta: rate of decay per calendar day (divide by 365)
  const thetaAnnual = isCall
    ? -(S * nd1 * σ) / (2 * sqrtT) - r * K * df * Nd2
    : -(S * nd1 * σ) / (2 * sqrtT) + r * K * df * Nnd2;
  const theta = thetaAnnual / 365;
  // Vega per 1% move in vol
  const vega  = S * nd1 * sqrtT / 100;
  // Rho per 1% move in rate
  const rho   = isCall
    ? K * T * df * Nd2  / 100
    : -K * T * df * Nnd2 / 100;

  return { price: p, delta, gamma, theta, vega, rho };
}

// Batch pricing — accepts array of option specs, returns array of results
// Structured for option chain reads: caller provides the full strike/expiry grid
export function priceChain(opts: OptionInput[]): OptionResult[] {
  return opts.map(price);
}
