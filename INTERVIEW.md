# Pre-Trade Analytics Dashboard — Interview Guide

15 bullets covering the key design decisions, mathematics, and trade-offs.

---

- **Why Black-Scholes over a binomial tree?** Closed-form gives O(1) pricing per option vs O(n²) for trees, critical for real-time chain grids with hundreds of strikes × expiries. The accuracy trade-off (no early exercise, constant vol) is acceptable for European equity/index options.

- **How is the standard normal CDF computed?** Using the Abramowitz & Stegun rational approximation (26.2.17), which has max absolute error ~1.5×10⁻⁷. Avoids `erf` lookups and is branch-free outside the ±8 clamp, making it fast and numerically stable.

- **What does Delta represent and how is it used here?** Delta (∂V/∂S) is the first-order sensitivity of option price to the underlying. Displayed per cell in the chain grid so traders can see hedge ratios at a glance without a separate request.

- **Explain the P&L attribution decomposition.** Total P&L = ΔS·δ + ½ΔS²·Γ + Δσ·ν + residual. The first-order Taylor expansion separates directional (delta), convexity (gamma), and volatility (vega) contributions. The residual captures cross-Greeks and higher-order terms.

- **Why is Theta divided by 365 instead of 252 trading days?** Calendar-day theta matches how options desks communicate decay — overnight weekends decay in calendar time, not trading time. The convention is configurable; some shops use 365 for equities, 252 for rates.

- **How does the API handle batch pricing efficiently?** `POST /chain` accepts an array and calls `priceChain()`, which is a simple `map` over `price()`. Because each pricing is O(1) and stateless, the array is processed in a tight loop with no I/O, keeping p95 < 5ms for 100 options locally.

- **What validation does `validateInput` perform?** Rejects spot ≤ 0, strike ≤ 0, expiry ≤ 0, vol ≤ 0, and invalid option type. Rate is allowed to be zero or negative (negative rates are real). Returns a descriptive error string rather than throwing, so the API layer can return a clean 400.

- **Why proxy `/price` and `/chain` through Vite instead of calling port 3001 directly?** Avoids CORS complexity during development. The Vite proxy rewrites requests to `localhost:3001` server-side, so the browser sees same-origin requests. Production would use nginx or an API gateway for the same purpose.

- **How would you extend this to support American options?** Replace the closed-form with a binomial/trinomial tree or finite-difference PDE solver for the early-exercise boundary. The `OptionInput` and `OptionResult` types are unchanged; only `price()` needs a new code path gated on `style: "american"`.

- **What are the limits of the put-call parity test?** Parity C − P = S − Ke^{−rT} holds exactly for European options with the same strike and expiry under continuous dividends. Failure indicates a bug in either the call or put pricing branch (e.g., wrong sign on delta formula for puts).

- **How does the Scenario Panel avoid stale UI state?** Both baseline and stressed fetch calls are triggered together inside a single `useEffect` whose dependency array includes all six slider values. React batches the two `setState` calls from the async responses, so the UI updates atomically.

- **What would you add for production use?** Input rate-limiting on the Express server, Redis caching for repeated strike/expiry combos, WebSocket streaming for live vol surface updates, and authentication via JWT or mTLS for desk-facing APIs.

- **How accurate is the implementation vs Hull's textbook?** The benchmark measures max absolute error < 0.15 across 10 Hull reference cases (tolerance accounts for Hull's 2dp rounding). Mean absolute error is typically < 0.05, well within bid-ask spread for liquid options.

- **Why store Vega as per 1% vol move rather than per 1 vol point?** Industry convention for equity options is to quote vega as the dollar change per 1 percentage-point move in implied vol (e.g., vol from 20% to 21%). This makes vega directly comparable to the vol spread, which traders think in percentage terms.

- **How would you build a vol surface from this engine?** Run `priceChain()` across all listed strikes and expiries, then back out implied vol per contract using bisection search on `price()`. Fit a parametric surface (SVI or SABR) to the implied vol grid. The chain grid panel is the first step — it already renders the full strike × expiry matrix.
