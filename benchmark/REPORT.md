# React Testing Framework Benchmark Report

> Generated: Sun, 05 Apr 2026 19:06:36 GMT

## Environment

| Property | Value |
|---|---|
| Node.js | v22.5.1 |
| Platform | darwin 25.4.0 |
| CPU | Apple M3 Pro |
| CPU Cores | 12 |
| Total RAM | 18.0 GB |
| Runs/scenario | 7 (trim ±1) |

## Scenarios

Each scenario runs the **same 9 React tests** across 5 test files:

| Test File | Tests |
|---|---|
| 'counter.test.jsx' | 1 — stateful counter, event interaction |
| 'hooks.test.jsx' | 2 — custom hook harness + `renderHook` |
| 'lifecycle.test.jsx' | 2 — `rerender`, `unmount` + effect cleanup |
| 'context.test.jsx' | 1 — `createContext` + wrapper injection |
| 'concurrency.test.jsx' | 2 — React 19 `use()` + `useTransition` |

### Frameworks under test

| Combination | DOM layer | Assertion style |
|---|---|---|
| poku + @pokujs/react | happy-dom | `assert.strictEqual` |
| poku + @pokujs/react | jsdom | `assert.strictEqual` |
| jest 29 + @testing-library/react | jsdom (jest-environment-jsdom) | `expect().toBe()` |
| vitest 3 + @testing-library/react | jsdom | `expect().toBe()` |
| vitest 3 + @testing-library/react | happy-dom | `expect().toBe()` |

## Results

| Scenario           | Mean   | Min    | Max    | Stdev  | Peak RSS | vs poku+happy-dom |
|--------------------|--------|--------|--------|--------|----------|-------------------|
| poku + happy-dom   | 0.115s | 0.112s | 0.109s | 0.004s | 127.4 MB | *(baseline)*      |
| poku + jsdom       | 0.294s | 0.280s | 0.299s | 0.007s | 172.1 MB | +157%             |
| jest + jsdom       | 0.843s | 0.768s | 0.879s | 0.041s | 198.8 MB | +636%             |
| vitest + jsdom     | 0.968s | 0.951s | 0.986s | 0.011s | 147.8 MB | +745%             |
| vitest + happy-dom | 0.845s | 0.825s | 0.856s | 0.013s | 115.2 MB | +637%             |

> **Poku elapsed time** uses Poku's reported suite `Duration` (ANSI-stripped parse) to avoid teardown-skew artifacts.
> **Jest/Vitest elapsed time** is measured with `performance.now()` around the child-process spawn.
> **Peak RSS** is captured via `/usr/bin/time -l` on macOS (bytes → MB).
> The baseline for relative comparisons is **poku + happy-dom**.

## Analysis

### Overall ranking (mean wall-clock time)

1. **poku + happy-dom** — 0.115s
2. **poku + jsdom** — 0.294s
3. **jest + jsdom** — 0.843s
4. **vitest + happy-dom** — 0.845s
5. **vitest + jsdom** — 0.968s

### Speed comparison

- poku+happy-dom vs jest+jsdom: jest is **636% slower**
- poku+happy-dom vs vitest+jsdom: vitest is **745% slower**
- jest+jsdom vs vitest+jsdom: vitest is **15% slower** than jest

### DOM adapter impact

- **poku**: happy-dom vs jsdom — jsdom is **157% slower**
- **vitest**: happy-dom vs jsdom — jsdom is **15% slower**

### Memory footprint

- **vitest + happy-dom**: 115.2 MB peak RSS
- **poku + happy-dom**: 127.4 MB peak RSS
- **vitest + jsdom**: 147.8 MB peak RSS
- **poku + jsdom**: 172.1 MB peak RSS
- **jest + jsdom**: 198.8 MB peak RSS

### Consistency (lower stdev = more predictable)

- **poku + happy-dom**: σ = 0.004s
- **poku + jsdom**: σ = 0.007s
- **vitest + jsdom**: σ = 0.011s
- **vitest + happy-dom**: σ = 0.013s
- **jest + jsdom**: σ = 0.041s

## Key findings

- **Fastest**: poku + happy-dom — 0.115s mean
- **Slowest**: vitest + jsdom — 0.968s mean
- **Speed spread**: 745% difference between fastest and slowest

### Interpretation

**poku + @pokujs/react** avoids the multi-process or bundler startup that jest (babel transform
pipeline) and vitest (Vite + module graph) require. Its architecture — isolated per-file Node.js
processes with minimal bootstrap — means cold-start overhead is proportional to the number of test
files, not to the framework's own initialization.

**jest** carries the heaviest startup cost due to:
1. Babel transformation of every TSX file on first run (no persistent cache in this benchmark)
2. 'jest-worker' process pool initialisation
3. JSDOM environment setup per test file

**vitest** starts faster than jest because Vite's module graph is more efficient, and the
esbuild/Rollup pipeline is faster than Babel. However, the Vite dev server and HMR machinery still
contribute to startup overhead compared to a zero-bundler approach.

**DOM adapter choice** (happy-dom vs jsdom) has a measurable but smaller effect than the choice of
framework. happy-dom is generally lighter and initialises faster; jsdom is more spec-complete.

## Reproducibility

```sh
# Install benchmark deps (one-time)
cd benchmark && npm install && cd ..

# Re-run with custom run count
BENCH_RUNS=10 node benchmark/run.mjs
```

Results are saved to `benchmark/results.json` for programmatic analysis.
