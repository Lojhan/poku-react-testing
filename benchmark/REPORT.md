# React Testing Framework Benchmark Report

> Generated: Tue, 31 Mar 2026 21:00:50 GMT

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
| poku + poku-react-testing | happy-dom | `assert.strictEqual` |
| poku + poku-react-testing | jsdom | `assert.strictEqual` |
| jest 29 + @testing-library/react | jsdom (jest-environment-jsdom) | `expect().toBe()` |
| vitest 3 + @testing-library/react | jsdom | `expect().toBe()` |
| vitest 3 + @testing-library/react | happy-dom | `expect().toBe()` |

## Results

| Scenario           | Mean   | Min    | Max    | Stdev  | Peak RSS | vs poku+happy-dom |
|--------------------|--------|--------|--------|--------|----------|-------------------|
| poku + happy-dom   | 1.073s | 0.996s | 1.230s | 0.085s | 163.3 MB | *(baseline)*      |
| poku + jsdom       | 1.060s | 1.007s | 1.177s | 0.060s | 163.4 MB | -1%               |
| jest + jsdom       | 0.859s | 0.779s | 0.929s | 0.050s | 206.2 MB | -20%              |
| vitest + jsdom     | 0.964s | 0.950s | 0.987s | 0.017s | 148.0 MB | -10%              |
| vitest + happy-dom | 0.838s | 0.812s | 0.864s | 0.021s | 116.3 MB | -22%              |

> **Wall-clock time** is measured with `performance.now()` around the child-process spawn.
> **Peak RSS** is captured via `/usr/bin/time -l` on macOS (bytes → MB).
> The baseline for relative comparisons is **poku + happy-dom**.

## Analysis

### Overall ranking (mean wall-clock time)

1. **vitest + happy-dom** — 0.838s
2. **jest + jsdom** — 0.859s
3. **vitest + jsdom** — 0.964s
4. **poku + jsdom** — 1.060s
5. **poku + happy-dom** — 1.073s

### Speed comparison

- poku+happy-dom vs jest+jsdom: jest is **-20% faster**
- poku+happy-dom vs vitest+jsdom: vitest is **-10% faster**
- jest+jsdom vs vitest+jsdom: vitest is **12% slower** than jest

### DOM adapter impact

- **poku**: happy-dom vs jsdom — jsdom is **-1% faster**
- **vitest**: happy-dom vs jsdom — jsdom is **15% slower**

### Memory footprint

- **vitest + happy-dom**: 116.3 MB peak RSS
- **vitest + jsdom**: 148.0 MB peak RSS
- **poku + happy-dom**: 163.3 MB peak RSS
- **poku + jsdom**: 163.4 MB peak RSS
- **jest + jsdom**: 206.2 MB peak RSS

### Consistency (lower stdev = more predictable)

- **vitest + jsdom**: σ = 0.017s
- **vitest + happy-dom**: σ = 0.021s
- **jest + jsdom**: σ = 0.050s
- **poku + jsdom**: σ = 0.060s
- **poku + happy-dom**: σ = 0.085s

## Key findings

- **Fastest**: vitest + happy-dom — 0.838s mean
- **Slowest**: poku + happy-dom — 1.073s mean
- **Speed spread**: 28% difference between fastest and slowest

### Interpretation

**poku + poku-react-testing** avoids the multi-process or bundler startup that jest (babel transform
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
