# React Testing Framework Benchmark Report

> Generated: Wed, 01 Apr 2026 12:41:50 GMT

## Environment

| Property      | Value         |
| ------------- | ------------- |
| Node.js       | v22.5.1       |
| Platform      | darwin 25.4.0 |
| CPU           | Apple M3 Pro  |
| CPU Cores     | 12            |
| Total RAM     | 18.0 GB       |
| Runs/scenario | 7 (trim ±1)   |

## Scenarios

Each scenario runs the **same 9 React tests** across 5 test files:

| Test File              | Tests                                      |
| ---------------------- | ------------------------------------------ |
| 'counter.test.jsx'     | 1 — stateful counter, event interaction    |
| 'hooks.test.jsx'       | 2 — custom hook harness + `renderHook`     |
| 'lifecycle.test.jsx'   | 2 — `rerender`, `unmount` + effect cleanup |
| 'context.test.jsx'     | 1 — `createContext` + wrapper injection    |
| 'concurrency.test.jsx' | 2 — React 19 `use()` + `useTransition`     |

### Frameworks under test

| Combination                       | DOM layer                      | Assertion style      |
| --------------------------------- | ------------------------------ | -------------------- |
| poku + @pokujs/react              | happy-dom                      | `assert.strictEqual` |
| poku + @pokujs/react              | jsdom                          | `assert.strictEqual` |
| jest 29 + @testing-library/react  | jsdom (jest-environment-jsdom) | `expect().toBe()`    |
| vitest 3 + @testing-library/react | jsdom                          | `expect().toBe()`    |
| vitest 3 + @testing-library/react | happy-dom                      | `expect().toBe()`    |

## Results

| Scenario           | Mean   | Min    | Max    | Stdev  | Peak RSS | vs poku+happy-dom |
| ------------------ | ------ | ------ | ------ | ------ | -------- | ----------------- |
| poku + happy-dom   | 0.560s | 0.515s | 0.600s | 0.033s | 154.3 MB | _(baseline)_      |
| poku + jsdom       | 0.444s | 0.429s | 0.451s | 0.008s | 157.1 MB | -21%              |
| jest + jsdom       | 1.040s | 0.975s | 1.135s | 0.056s | 203.4 MB | +86%              |
| vitest + jsdom     | 1.193s | 1.129s | 1.269s | 0.057s | 152.3 MB | +113%             |
| vitest + happy-dom | 1.041s | 0.990s | 1.126s | 0.047s | 117.1 MB | +86%              |

> **Wall-clock time** is measured with `performance.now()` around the child-process spawn.
> **Peak RSS** is captured via `/usr/bin/time -l` on macOS (bytes → MB).
> The baseline for relative comparisons is **poku + happy-dom**.

## Analysis

### Overall ranking (mean wall-clock time)

1. **poku + jsdom** — 0.444s
2. **poku + happy-dom** — 0.560s
3. **jest + jsdom** — 1.040s
4. **vitest + happy-dom** — 1.041s
5. **vitest + jsdom** — 1.193s

### Speed comparison

- poku+happy-dom vs jest+jsdom: jest is **86% slower**
- poku+happy-dom vs vitest+jsdom: vitest is **113% slower**
- jest+jsdom vs vitest+jsdom: vitest is **15% slower** than jest

### DOM adapter impact

- **poku**: happy-dom vs jsdom — jsdom is **-21% faster**
- **vitest**: happy-dom vs jsdom — jsdom is **15% slower**

### Memory footprint

- **vitest + happy-dom**: 117.1 MB peak RSS
- **vitest + jsdom**: 152.3 MB peak RSS
- **poku + happy-dom**: 154.3 MB peak RSS
- **poku + jsdom**: 157.1 MB peak RSS
- **jest + jsdom**: 203.4 MB peak RSS

### Consistency (lower stdev = more predictable)

- **poku + jsdom**: σ = 0.008s
- **poku + happy-dom**: σ = 0.033s
- **vitest + happy-dom**: σ = 0.047s
- **jest + jsdom**: σ = 0.056s
- **vitest + jsdom**: σ = 0.057s

## Key findings

- **Fastest**: poku + jsdom — 0.444s mean
- **Slowest**: vitest + jsdom — 1.193s mean
- **Speed spread**: 169% difference between fastest and slowest

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
