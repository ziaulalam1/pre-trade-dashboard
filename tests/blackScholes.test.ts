import { price, priceChain, validateInput, normCDF } from "../backend/src/blackScholes";

const base = { spot: 100, strike: 100, expiry: 1, rate: 0.05, vol: 0.2 };

describe("Black-Scholes", () => {
  test("put-call parity: C - P = S - K*e^(-rT)", () => {
    const C = price({ ...base, type: "call" }).price;
    const P = price({ ...base, type: "put" }).price;
    const S = base.spot;
    const K = base.strike;
    const r = base.rate;
    const T = base.expiry;
    const parity = S - K * Math.exp(-r * T);
    expect(Math.abs((C - P) - parity)).toBeLessThan(1e-10);
  });

  test("delta bounds: 0 < delta_call < 1", () => {
    const d = price({ ...base, type: "call" }).delta;
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1);
  });

  test("delta bounds: -1 < delta_put < 0", () => {
    const d = price({ ...base, type: "put" }).delta;
    expect(d).toBeGreaterThan(-1);
    expect(d).toBeLessThan(0);
  });

  test("gamma always positive", () => {
    expect(price({ ...base, type: "call" }).gamma).toBeGreaterThan(0);
    expect(price({ ...base, type: "put" }).gamma).toBeGreaterThan(0);
  });

  test("ATM call delta ≈ 0.5 (within 0.02)", () => {
    const d = price({ ...base, expiry: 0.01, type: "call" }).delta;
    expect(Math.abs(d - 0.5)).toBeLessThan(0.02);
  });

  test("deep ITM call delta → 1", () => {
    const d = price({ ...base, spot: 200, type: "call" }).delta;
    expect(d).toBeGreaterThan(0.99);
  });

  test("validateInput rejects spot <= 0", () => {
    expect(validateInput({ ...base, spot: 0, type: "call" })).not.toBeNull();
    expect(validateInput({ ...base, spot: -1, type: "call" })).not.toBeNull();
  });

  test("validateInput rejects vol <= 0", () => {
    expect(validateInput({ ...base, vol: 0, type: "call" })).not.toBeNull();
    expect(validateInput({ ...base, vol: -0.1, type: "call" })).not.toBeNull();
  });

  test("validateInput rejects strike <= 0", () => {
    expect(validateInput({ ...base, strike: 0, type: "call" })).not.toBeNull();
  });

  test("validateInput rejects expiry <= 0", () => {
    expect(validateInput({ ...base, expiry: 0, type: "call" })).not.toBeNull();
  });

  test("validateInput rejects invalid type", () => {
    expect(validateInput({ ...base, type: "forward" as any })).not.toBeNull();
  });

  test("validateInput accepts valid input", () => {
    expect(validateInput({ ...base, type: "call" })).toBeNull();
    expect(validateInput({ ...base, type: "put" })).toBeNull();
  });

  test("priceChain returns array of same length", () => {
    const inputs = [
      { ...base, type: "call" as const },
      { ...base, strike: 105, type: "put" as const },
    ];
    const results = priceChain(inputs);
    expect(results).toHaveLength(2);
  });
});
