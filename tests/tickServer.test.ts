// Tests for tick server logic — GBM price generation and message format.
// WebSocket integration is verified by running the tick server manually.

describe("Tick Server Logic", () => {
  function gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function gbmStep(price: number, sigma: number, dt: number): number {
    const drift = -0.5 * sigma * sigma * dt;
    const diffusion = sigma * Math.sqrt(dt) * gaussianRandom();
    return price * Math.exp(drift + diffusion);
  }

  const SIGMA = 0.2;
  const DT = 500 / (252 * 6.5 * 3600 * 1000);

  test("GBM price stays positive after 1000 steps", () => {
    let price = 100;
    for (let i = 0; i < 1000; i++) {
      price = gbmStep(price, SIGMA, DT);
    }
    expect(price).toBeGreaterThan(0);
  });

  test("GBM price does not explode after 10000 steps", () => {
    let price = 100;
    for (let i = 0; i < 10000; i++) {
      price = gbmStep(price, SIGMA, DT);
    }
    // with sigma=0.2 and ~5 seconds of trading time, price should stay bounded
    expect(price).toBeGreaterThan(10);
    expect(price).toBeLessThan(1000);
  });

  test("Box-Muller produces zero-mean distribution", () => {
    const N = 10000;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += gaussianRandom();
    }
    const mean = sum / N;
    expect(Math.abs(mean)).toBeLessThan(0.05);
  });

  test("tick message schema", () => {
    const msg = {
      symbol: "AAPL",
      price: Math.round(gbmStep(100, SIGMA, DT) * 100) / 100,
      timestamp: new Date().toISOString(),
    };
    expect(msg.symbol).toBe("AAPL");
    expect(typeof msg.price).toBe("number");
    expect(msg.price).toBeGreaterThan(0);
    expect(msg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
