import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface OptionInput {
  spot: number;
  strike: number;
  expiry: number;
  rate: number;
  vol: number;
  type: "call" | "put";
}

interface OptionResult {
  price: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

// ── Black-Scholes Engine (inline — no backend needed) ────────────────────────

function normCDF(x: number): number {
  if (x < -8) return 0;
  if (x >  8) return 1;
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

function normPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function priceOption(opt: OptionInput): OptionResult {
  const { spot: S, strike: K, expiry: T, rate: r, vol: sig, type } = opt;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sig * sig) * T) / (sig * sqrtT);
  const d2 = d1 - sig * sqrtT;
  const df = Math.exp(-r * T);
  const Nd1 = normCDF(d1), Nd2 = normCDF(d2);
  const Nnd1 = normCDF(-d1), Nnd2 = normCDF(-d2);
  const nd1 = normPDF(d1);
  const isCall = type === "call";
  const price = isCall ? S * Nd1 - K * df * Nd2 : K * df * Nnd2 - S * Nnd1;
  const delta = isCall ? Nd1 : Nd1 - 1;
  const gamma = nd1 / (S * sig * sqrtT);
  const thetaAnnual = isCall
    ? -(S * nd1 * sig) / (2 * sqrtT) - r * K * df * Nd2
    : -(S * nd1 * sig) / (2 * sqrtT) + r * K * df * Nnd2;
  const theta = thetaAnnual / 365;
  const vega = S * nd1 * sqrtT / 100;
  const rho = isCall ? K * T * df * Nd2 / 100 : -K * T * df * Nnd2 / 100;
  return { price, delta, gamma, theta, vega, rho };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPrice(input: OptionInput): Promise<OptionResult | null> {
  return priceOption(input);
}

async function fetchChain(inputs: OptionInput[]): Promise<OptionResult[]> {
  return inputs.map(priceOption);
}

const fmt = (n: number, d = 4) => n.toFixed(d);

// ── Tick Stream Hook ─────────────────────────────────────────────────────────

const TICK_WS_URL = "ws://localhost:3002";

interface Tick {
  symbol: string;
  price: number;
  timestamp: string;
}

function useTickStream(): { tick: Tick | null; connected: boolean } {
  const [tick, setTick] = useState<Tick | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(TICK_WS_URL);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          retryRef.current = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
        ws.onmessage = (e) => {
          try { setTick(JSON.parse(e.data)); } catch {}
        };
      } catch {
        retryRef.current = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  return { tick, connected };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontFamily: "monospace",
    background: "#0d1117",
    color: "#e6edf3",
    minHeight: "100vh",
    padding: "24px",
    boxSizing: "border-box",
  },
  h1: { fontSize: "20px", fontWeight: "bold", marginBottom: "24px", color: "#58a6ff" },
  panel: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "24px",
  },
  h2: { fontSize: "15px", fontWeight: "bold", marginBottom: "16px", color: "#79c0ff" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "12px" },
  th: {
    background: "#21262d",
    padding: "6px 10px",
    textAlign: "right" as const,
    color: "#8b949e",
    border: "1px solid #30363d",
  },
  td: {
    padding: "5px 10px",
    textAlign: "right" as const,
    border: "1px solid #21262d",
    fontSize: "11px",
  },
  sliderRow: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" },
  label: { width: "80px", fontSize: "12px", color: "#8b949e" },
  slider: { flex: 1 },
  value: { width: "60px", fontSize: "12px", textAlign: "right" as const },
  resultBox: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "16px",
  },
  card: {
    background: "#21262d",
    borderRadius: "6px",
    padding: "12px",
    border: "1px solid #30363d",
  },
  cardTitle: { fontSize: "11px", color: "#8b949e", marginBottom: "8px" },
  metric: { fontSize: "13px", marginBottom: "4px" },
  pnlBox: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" },
  pnlCard: {
    background: "#21262d",
    borderRadius: "6px",
    padding: "12px",
    border: "1px solid #30363d",
    textAlign: "center" as const,
  },
  pnlLabel: { fontSize: "11px", color: "#8b949e", marginBottom: "6px" },
  pnlValue: { fontSize: "18px", fontWeight: "bold" },
  inputRow: { display: "flex", gap: "16px", marginBottom: "16px", flexWrap: "wrap" as const },
  inputGroup: { display: "flex", flexDirection: "column" as const, gap: "4px" },
  inputLabel: { fontSize: "11px", color: "#8b949e" },
  input: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "4px",
    color: "#e6edf3",
    padding: "6px 8px",
    fontSize: "12px",
    width: "90px",
  },
  select: {
    background: "#21262d",
    border: "1px solid #30363d",
    borderRadius: "4px",
    color: "#e6edf3",
    padding: "6px 8px",
    fontSize: "12px",
    width: "90px",
  },
};

// ── Panel 1: Option Chain Grid ────────────────────────────────────────────────

const STRIKES = [90, 95, 100, 105, 110];
const EXPIRIES = [0.083, 0.25, 0.5, 1.0]; // ~1m, 3m, 6m, 1y

function ChainPanel({ liveTick, liveConnected }: { liveTick: Tick | null; liveConnected: boolean }) {
  const [spot, setSpot] = useState(100);
  const [vol, setVol] = useState(0.2);
  const [rate, setRate] = useState(0.05);
  const [optType, setOptType] = useState<"call" | "put">("call");
  const [grid, setGrid] = useState<(OptionResult | null)[][]>([]);
  const [loading, setLoading] = useState(false);

  // update spot from live tick stream
  useEffect(() => {
    if (liveTick && liveConnected) {
      setSpot(liveTick.price);
    }
  }, [liveTick, liveConnected]);

  const loadChain = useCallback(async () => {
    setLoading(true);
    const inputs: OptionInput[] = [];
    for (const T of EXPIRIES) {
      for (const K of STRIKES) {
        inputs.push({ spot, strike: K, expiry: T, rate, vol, type: optType });
      }
    }
    const results = await fetchChain(inputs);
    // reshape into [expiry][strike]
    const shaped: (OptionResult | null)[][] = [];
    let idx = 0;
    for (let e = 0; e < EXPIRIES.length; e++) {
      shaped[e] = [];
      for (let s = 0; s < STRIKES.length; s++) {
        shaped[e][s] = results[idx++] ?? null;
      }
    }
    setGrid(shaped);
    setLoading(false);
  }, [spot, vol, rate, optType]);

  useEffect(() => { loadChain(); }, [loadChain]);

  const expiryLabel = (T: number) =>
    T < 0.1 ? "1m" : T < 0.3 ? "3m" : T < 0.6 ? "6m" : "1y";

  return (
    <div style={styles.panel}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", ...styles.h2 }}>
        Option Chain Grid
        {liveConnected && (
          <span style={{
            fontSize: "10px",
            background: "#238636",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: "10px",
            fontWeight: "normal",
          }}>
            LIVE {liveTick?.symbol}
          </span>
        )}
      </div>
      <div style={styles.inputRow}>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Spot{liveConnected ? " (live)" : ""}</span>
          <input style={styles.input} type="number" value={Math.round(spot * 100) / 100}
            onChange={e => setSpot(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Vol</span>
          <input style={styles.input} type="number" step="0.01" value={vol}
            onChange={e => setVol(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Rate</span>
          <input style={styles.input} type="number" step="0.01" value={rate}
            onChange={e => setRate(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Type</span>
          <select style={styles.select} value={optType}
            onChange={e => setOptType(e.target.value as "call" | "put")}>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#8b949e", fontSize: "12px" }}>Loading...</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, textAlign: "left" }}>Expiry \ Strike</th>
              {STRIKES.map(K => <th key={K} style={styles.th}>{K}</th>)}
            </tr>
          </thead>
          <tbody>
            {EXPIRIES.map((T, ei) => (
              <tr key={T}>
                <td style={{ ...styles.td, color: "#8b949e", textAlign: "left" }}>
                  {expiryLabel(T)}
                </td>
                {STRIKES.map((K, si) => {
                  const r = grid[ei]?.[si];
                  return (
                    <td key={K} style={{
                      ...styles.td,
                      background: K === spot ? "#1c2b3a" : undefined,
                    }}>
                      {r ? (
                        <span>
                          <span style={{ color: "#3fb950" }}>{fmt(r.price, 2)}</span>
                          <span style={{ color: "#8b949e", marginLeft: "4px" }}>
                            Δ{fmt(r.delta, 3)}
                          </span>
                        </span>
                      ) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Panel 2: Scenario Panel ────────────────────────────────────────────────────

function ScenarioPanel() {
  const [baseSpot, setBaseSpot] = useState(100);
  const [baseVol, setBaseVol] = useState(0.2);
  const [baseRate, setBaseRate] = useState(0.05);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [optType, setOptType] = useState<"call" | "put">("call");

  // Stressed parameters
  const [stressSpot, setStressSpot] = useState(110);
  const [stressVol, setStressVol] = useState(0.3);
  const [stressRate, setStressRate] = useState(0.06);

  const [baseline, setBaseline] = useState<OptionResult | null>(null);
  const [stressed, setStressed] = useState<OptionResult | null>(null);

  useEffect(() => {
    const baseInput: OptionInput = { spot: baseSpot, strike, expiry, rate: baseRate, vol: baseVol, type: optType };
    const stressInput: OptionInput = { spot: stressSpot, strike, expiry, rate: stressRate, vol: stressVol, type: optType };
    fetchPrice(baseInput).then(setBaseline);
    fetchPrice(stressInput).then(setStressed);
  }, [baseSpot, baseVol, baseRate, stressSpot, stressVol, stressRate, strike, expiry, optType]);

  const Slider = ({
    label, value, onChange, min, max, step,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step: number;
  }) => (
    <div style={styles.sliderRow}>
      <span style={styles.label}>{label}</span>
      <input
        type="range" style={styles.slider}
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
      />
      <span style={styles.value}>{value}</span>
    </div>
  );

  const greeks = (r: OptionResult | null) =>
    r ? [
      ["Price", fmt(r.price, 4)],
      ["Delta", fmt(r.delta, 4)],
      ["Gamma", fmt(r.gamma, 6)],
      ["Theta/day", fmt(r.theta, 4)],
      ["Vega/1%", fmt(r.vega, 4)],
      ["Rho/1%", fmt(r.rho, 4)],
    ] : [];

  return (
    <div style={styles.panel}>
      <div style={styles.h2}>Scenario Analysis</div>
      <div style={styles.inputRow}>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Strike</span>
          <input style={styles.input} type="number" value={strike}
            onChange={e => setStrike(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Expiry (yr)</span>
          <input style={styles.input} type="number" step="0.1" value={expiry}
            onChange={e => setExpiry(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Type</span>
          <select style={styles.select} value={optType}
            onChange={e => setOptType(e.target.value as "call" | "put")}>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>Baseline</div>
          <Slider label="Spot" value={baseSpot} onChange={setBaseSpot} min={50} max={200} step={1} />
          <Slider label="Vol" value={baseVol} onChange={setBaseVol} min={0.01} max={1} step={0.01} />
          <Slider label="Rate" value={baseRate} onChange={setBaseRate} min={0} max={0.2} step={0.005} />
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>Stressed</div>
          <Slider label="Spot" value={stressSpot} onChange={setStressSpot} min={50} max={200} step={1} />
          <Slider label="Vol" value={stressVol} onChange={setStressVol} min={0.01} max={1} step={0.01} />
          <Slider label="Rate" value={stressRate} onChange={setStressRate} min={0} max={0.2} step={0.005} />
        </div>
      </div>

      <div style={styles.resultBox}>
        {[["Baseline", baseline], ["Stressed", stressed]].map(([label, res]) => (
          <div key={label as string} style={styles.card}>
            <div style={styles.cardTitle}>{label as string}</div>
            {greeks(res as OptionResult | null).map(([k, v]) => (
              <div key={k} style={styles.metric}>
                <span style={{ color: "#8b949e" }}>{k}: </span>
                <span style={{ color: "#e6edf3" }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {baseline && stressed && (
        <div style={{ marginTop: "16px", fontSize: "12px" }}>
          <span style={{ color: "#8b949e" }}>Price change: </span>
          <span style={{ color: stressed.price >= baseline.price ? "#3fb950" : "#f85149", fontWeight: "bold" }}>
            {stressed.price >= baseline.price ? "+" : ""}
            {fmt(stressed.price - baseline.price, 4)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Panel 3: P&L Attribution ───────────────────────────────────────────────────

function PnlPanel() {
  const [entryPrice, setEntryPrice] = useState(10.45);
  const [entrySpot, setEntrySpot] = useState(100);
  const [entryVol, setEntryVol] = useState(0.2);
  const [currentSpot, setCurrentSpot] = useState(103);
  const [currentVol, setCurrentVol] = useState(0.22);
  const [strike, setStrike] = useState(100);
  const [expiry, setExpiry] = useState(1.0);
  const [rate, setRate] = useState(0.05);
  const [optType, setOptType] = useState<"call" | "put">("call");

  const [attribution, setAttribution] = useState<{
    totalPnl: number;
    deltaContrib: number;
    gammaContrib: number;
    vegaContrib: number;
    residual: number;
    currentPrice: number;
  } | null>(null);

  useEffect(() => {
    const entryInput: OptionInput = {
      spot: entrySpot, strike, expiry, rate, vol: entryVol, type: optType,
    };
    fetchPrice(entryInput).then(entryResult => {
      if (!entryResult) return;
      const dS = currentSpot - entrySpot;
      const dVol = currentVol - entryVol;
      const deltaContrib = entryResult.delta * dS;
      const gammaContrib = 0.5 * entryResult.gamma * dS * dS;
      // vega is per 1% vol, dVol is in decimal → multiply by 100
      const vegaContrib = entryResult.vega * (dVol * 100);

      const currentInput: OptionInput = {
        spot: currentSpot, strike, expiry, rate, vol: currentVol, type: optType,
      };
      fetchPrice(currentInput).then(currentResult => {
        if (!currentResult) return;
        const totalPnl = currentResult.price - entryPrice;
        const explained = deltaContrib + gammaContrib + vegaContrib;
        setAttribution({
          totalPnl,
          deltaContrib,
          gammaContrib,
          vegaContrib,
          residual: totalPnl - explained,
          currentPrice: currentResult.price,
        });
      });
    });
  }, [entryPrice, entrySpot, entryVol, currentSpot, currentVol, strike, expiry, rate, optType]);

  const color = (n: number) => n >= 0 ? "#3fb950" : "#f85149";

  return (
    <div style={styles.panel}>
      <div style={styles.h2}>P&amp;L Attribution</div>
      <div style={styles.inputRow}>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Strike</span>
          <input style={styles.input} type="number" value={strike}
            onChange={e => setStrike(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Expiry (yr)</span>
          <input style={styles.input} type="number" step="0.1" value={expiry}
            onChange={e => setExpiry(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Rate</span>
          <input style={styles.input} type="number" step="0.01" value={rate}
            onChange={e => setRate(+e.target.value)} />
        </div>
        <div style={styles.inputGroup}>
          <span style={styles.inputLabel}>Type</span>
          <select style={styles.select} value={optType}
            onChange={e => setOptType(e.target.value as "call" | "put")}>
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>Entry</div>
          {[
            ["Paid Price", entryPrice, setEntryPrice, 0.01, 0, 50],
            ["Spot", entrySpot, setEntrySpot, 1, 1, 300],
            ["Vol", entryVol, setEntryVol, 0.01, 0.01, 2],
          ].map(([label, value, setter, step, min, max]) => (
            <div key={label as string} style={styles.inputGroup}>
              <span style={styles.inputLabel}>{label as string}</span>
              <input style={styles.input} type="number"
                step={step as number} min={min as number} max={max as number}
                value={value as number}
                onChange={e => (setter as (v: number) => void)(+e.target.value)} />
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>Current</div>
          {[
            ["Spot", currentSpot, setCurrentSpot, 1, 1, 300],
            ["Vol", currentVol, setCurrentVol, 0.01, 0.01, 2],
          ].map(([label, value, setter, step, min, max]) => (
            <div key={label as string} style={styles.inputGroup}>
              <span style={styles.inputLabel}>{label as string}</span>
              <input style={styles.input} type="number"
                step={step as number} min={min as number} max={max as number}
                value={value as number}
                onChange={e => (setter as (v: number) => void)(+e.target.value)} />
            </div>
          ))}
        </div>
        {attribution && (
          <div>
            <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>Summary</div>
            <div style={{ fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#8b949e" }}>Entry Price: </span>{fmt(entryPrice)}
            </div>
            <div style={{ fontSize: "12px", marginBottom: "4px" }}>
              <span style={{ color: "#8b949e" }}>Current Price: </span>{fmt(attribution.currentPrice)}
            </div>
          </div>
        )}
      </div>

      {attribution && (
        <div style={styles.pnlBox}>
          {[
            ["Total P&L", attribution.totalPnl],
            ["Delta (ΔS)", attribution.deltaContrib],
            ["Gamma (½ΓΔS²)", attribution.gammaContrib],
            ["Vega (νΔσ)", attribution.vegaContrib],
            ["Residual", attribution.residual],
          ].map(([label, value]) => (
            <div key={label as string} style={styles.pnlCard}>
              <div style={styles.pnlLabel}>{label as string}</div>
              <div style={{ ...styles.pnlValue, color: color(value as number) }}>
                {(value as number) >= 0 ? "+" : ""}{fmt(value as number)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────────

export default function App() {
  const { tick, connected } = useTickStream();

  return (
    <div style={styles.root}>
      <h1 style={styles.h1}>Pre-Trade Analytics Dashboard</h1>
      <ChainPanel liveTick={tick} liveConnected={connected} />
      <ScenarioPanel />
      <PnlPanel />
    </div>
  );
}
