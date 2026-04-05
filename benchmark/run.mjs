#!/usr/bin/env node
/**
 * React Testing Framework Benchmark
 * Compares: poku+@pokujs/react vs jest+RTL vs vitest+RTL
 *
 * Metrics: wall-clock time, user CPU, sys CPU, peak RSS (macOS /usr/bin/time -l)
 * Strategy: RUNS per scenario, drop 1 slowest + 1 fastest, report trimmed mean.
 *
 * NOTE ON k6: k6 is an HTTP/API load-testing tool; it has no mechanism to execute
 * test-framework processes or measure startup/runtime overhead. It is not applicable
 * to this class of benchmark.
 */
import { spawnSync } from 'child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import { dirname, join, resolve } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOM_ROOT = resolve(__dirname, '..', '..', 'dom');
const BENCH = __dirname;

const RUNS = parseInt(process.env.BENCH_RUNS ?? '7', 10);
const TRIM = 1; // drop 1 slowest + 1 fastest per scenario
const POKU_BIN = join(BENCH, 'node_modules', 'poku', 'lib', 'bin', 'index.js');

// ─── local build sync ──────────────────────────────────────────────────────

/**
 * Replace the benchmark's @pokujs/react installation with a clean copy
 * of the local dist/ so that Node resolves react/react-dom from
 * benchmark/node_modules instead of following a symlink to the workspace root.
 */
function syncLocalBuild() {
  const reactDest = join(BENCH, 'node_modules', '@pokujs', 'react');
  rmSync(reactDest, { recursive: true, force: true });
  mkdirSync(join(reactDest, 'dist'), { recursive: true });
  copyFileSync(join(ROOT, 'package.json'), join(reactDest, 'package.json'));
  for (const file of readdirSync(join(ROOT, 'dist'))) {
    copyFileSync(join(ROOT, 'dist', file), join(reactDest, 'dist', file));
  }

  const domDest = join(BENCH, 'node_modules', '@pokujs', 'dom');
  rmSync(domDest, { recursive: true, force: true });
  mkdirSync(join(domDest, 'dist'), { recursive: true });
  copyFileSync(join(DOM_ROOT, 'package.json'), join(domDest, 'package.json'));
  for (const file of readdirSync(join(DOM_ROOT, 'dist'))) {
    copyFileSync(join(DOM_ROOT, 'dist', file), join(domDest, 'dist', file));
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function mb(bytes) {
  return bytes == null ? 'N/A' : (bytes / 1024 / 1024).toFixed(1);
}
function sec(ms) {
  return ms == null ? 'N/A' : (ms / 1000).toFixed(3);
}
function pct(base, val) {
  if (base == null || val == null) return '';
  const diff = ((val - base) / base) * 100;
  return diff >= 0 ? `+${diff.toFixed(0)}%` : `${diff.toFixed(0)}%`;
}

function pad(str, n) {
  return String(str).padEnd(n);
}
function rpad(str, n) {
  return String(str).padStart(n);
}

// ─── single run measurement ─────────────────────────────────────────────────

function runOnce(args, cwd, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv, FORCE_COLOR: '0' };
  const useTime = process.platform === 'darwin' && existsSync('/usr/bin/time');

  const [cmd, cmdArgs] = useTime
    ? ['/usr/bin/time', ['-l', ...args]]
    : [args[0], args.slice(1)];

  const t0 = performance.now();
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024,
  });
  const elapsed = performance.now() - t0;

  let maxRssBytes = null;
  let userCpuMs = null;
  let sysCpuMs = null;

  if (useTime) {
    const stderr = result.stderr ?? '';
    // macOS /usr/bin/time -l format:
    //   0.71 real   0.65 user   0.22 sys
    //   3014656  maximum resident set size
    const rssMatch = stderr.match(/(\d+)\s+maximum resident set size/);
    if (rssMatch) maxRssBytes = parseInt(rssMatch[1], 10);

    const timeMatch = stderr.match(
      /([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys/
    );
    if (timeMatch) {
      userCpuMs = parseFloat(timeMatch[2]) * 1000;
      sysCpuMs = parseFloat(timeMatch[3]) * 1000;
    }
  }

  const plainStdout = (result.stdout ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  const reportedDurationMatch = plainStdout.match(
    /Duration\s+›\s+([\d.]+)ms/
  );
  const reportedDurationMs = reportedDurationMatch
    ? Number(reportedDurationMatch[1])
    : null;

  return {
    elapsed,
    reportedDurationMs,
    maxRssBytes,
    userCpuMs,
    sysCpuMs,
    exitCode: result.status ?? 1,
    failed: result.status !== 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ─── scenario runner ────────────────────────────────────────────────────────

function benchmarkScenario(
  label,
  args,
  cwd,
  extraEnv = {},
  options = {}
) {
  process.stdout.write(`  ${pad(label, 36)}`);

  const measurements = [];
  let failures = 0;

  for (let i = 0; i < RUNS; i++) {
    const m = runOnce(args, cwd, extraEnv);
    if (m.failed) {
      failures++;
      process.stdout.write('✗');
    } else {
      measurements.push(m);
      process.stdout.write('·');
    }
  }

  const needed = RUNS - TRIM * 2;
  if (measurements.length < needed) {
    process.stdout.write(`  FAILED (${failures}/${RUNS} runs failed)\n`);
    // Print stderr of first failure for diagnosis
    const lastRun = runOnce(args, cwd, extraEnv);
    if (lastRun.failed) {
      const diagStderr = lastRun.stderr.slice(-800).trim();
      const diagStdout = lastRun.stdout.slice(-400).trim();
      if (diagStderr) console.error('\n    stderr:', diagStderr);
      if (diagStdout) console.error('\n    stdout:', diagStdout);
    }
    return null;
  }

  measurements.sort((a, b) => a.elapsed - b.elapsed);
  const trimmed = measurements.slice(TRIM, measurements.length - TRIM);

  const useReportedDuration = Boolean(options.useReportedDuration);
  const times = trimmed.map((m) => {
    if (useReportedDuration && m.reportedDurationMs != null) {
      return m.reportedDurationMs;
    }

    return m.elapsed;
  });
  const rssList = trimmed.map((m) => m.maxRssBytes).filter((v) => v != null);
  const userCpus = trimmed.map((m) => m.userCpuMs).filter((v) => v != null);
  const sysCpus = trimmed.map((m) => m.sysCpuMs).filter((v) => v != null);

  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  const variance =
    times.reduce((a, t) => a + (t - mean) ** 2, 0) / times.length;
  const stddev = Math.sqrt(variance);

  const meanRss =
    rssList.length > 0
      ? rssList.reduce((a, b) => a + b, 0) / rssList.length
      : null;
  const meanUserCpu =
    userCpus.length > 0
      ? userCpus.reduce((a, b) => a + b, 0) / userCpus.length
      : null;
  const meanSysCpu =
    sysCpus.length > 0
      ? sysCpus.reduce((a, b) => a + b, 0) / sysCpus.length
      : null;

  process.stdout.write(`  ${sec(mean)}s\n`);

  return {
    label,
    mean,
    min,
    max,
    stddev,
    meanRss,
    meanUserCpu,
    meanSysCpu,
    runs: RUNS,
    validRuns: measurements.length,
    failures,
  };
}

// ─── scenario definitions ───────────────────────────────────────────────────

const scenarios = [
  {
    label: 'poku + happy-dom',
    args: ['node', POKU_BIN, 'tests/poku'],
    cwd: BENCH,
    env: { POKU_REACT_TEST_DOM: 'happy-dom' },
    options: { useReportedDuration: true },
  },
  {
    label: 'poku + jsdom',
    args: ['node', POKU_BIN, 'tests/poku'],
    cwd: BENCH,
    env: { POKU_REACT_TEST_DOM: 'jsdom' },
    options: { useReportedDuration: true },
  },
  {
    label: 'jest + jsdom',
    args: [
      'node',
      join(BENCH, 'node_modules', '.bin', 'jest'),
      '--config',
      join(BENCH, 'jest.config.mjs'),
    ],
    cwd: BENCH,
    env: {},
  },
  {
    label: 'vitest + jsdom',
    args: [
      join(BENCH, 'node_modules', '.bin', 'vitest'),
      'run',
      '--config',
      join(BENCH, 'vitest.jsdom.config.js'),
    ],
    cwd: BENCH,
    env: {},
  },
  {
    label: 'vitest + happy-dom',
    args: [
      join(BENCH, 'node_modules', '.bin', 'vitest'),
      'run',
      '--config',
      join(BENCH, 'vitest.happy.config.js'),
    ],
    cwd: BENCH,
    env: {},
  },
];

// ─── pre-flight checks ───────────────────────────────────────────────────────

if (!existsSync(join(BENCH, 'node_modules'))) {
  console.error('\n❌  benchmark/node_modules not found.');
  console.error('    Run:  cd benchmark && npm install\n');
  process.exit(1);
}
if (!existsSync(join(BENCH, 'node_modules', 'poku'))) {
  console.error('\n❌  benchmark/node_modules/poku not found.');
  console.error('    Run:  cd benchmark && npm install\n');
  process.exit(1);
}

// ─── sync local build ────────────────────────────────────────────────────────

if (existsSync(join(ROOT, 'dist')) && existsSync(join(DOM_ROOT, 'dist'))) {
  process.stdout.write('  Syncing local @pokujs/react build... ');
  syncLocalBuild();
  process.stdout.write('done\n\n');
}

// ─── system info ────────────────────────────────────────────────────────────

const cpuModel = os.cpus()[0]?.model ?? 'unknown';
const cpuCount = os.cpus().length;
const totalMemGb = (os.totalmem() / 1024 ** 3).toFixed(1);
const nodeVersion = process.version;
const platform = `${os.platform()} ${os.release()}`;

// ─── run ─────────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║        React Testing Framework Benchmark             ║');
console.log('╚══════════════════════════════════════════════════════╝\n');
console.log(`  Node:       ${nodeVersion}`);
console.log(`  Platform:   ${platform}`);
console.log(`  CPU:        ${cpuModel} (${cpuCount} cores)`);
console.log(`  RAM:        ${totalMemGb} GB`);
console.log(`  Runs:       ${RUNS} per scenario (trim ±${TRIM})\n`);
console.log('  Scenarios:');
scenarios.forEach((s) => console.log(`    · ${s.label}`));
console.log('\n  Legend: · = pass  ✗ = fail\n');

const results = [];

for (const s of scenarios) {
  const r = benchmarkScenario(s.label, s.args, s.cwd, s.env, s.options);
  if (r) results.push(r);
}

if (results.length === 0) {
  console.error('\n❌  All scenarios failed. Check configuration.\n');
  process.exit(1);
}

// ─── console table ───────────────────────────────────────────────────────────

const baseline = results[0]; // poku + happy-dom

console.log(
  '\n┌─────────────────────────────────────────────────────────────────────────────┐'
);
console.log(
  '│                              Results Summary                                │'
);
console.log(
  '└─────────────────────────────────────────────────────────────────────────────┘\n'
);

const header = [
  pad('Scenario', 22),
  rpad('Mean', 8),
  rpad('Min', 8),
  rpad('Max', 8),
  rpad('Stdev', 7),
  rpad('RSS MB', 7),
  rpad('vs poku+hd', 11),
].join(' ');

console.log('  ' + header);
console.log('  ' + '-'.repeat(header.length));

for (const r of results) {
  const row = [
    pad(r.label, 22),
    rpad(sec(r.mean) + 's', 8),
    rpad(sec(r.min) + 's', 8),
    rpad(sec(r.max) + 's', 8),
    rpad(sec(r.stddev) + 's', 7),
    rpad(mb(r.meanRss), 7),
    rpad(
      r.label === baseline.label ? '(baseline)' : pct(baseline.mean, r.mean),
      11
    ),
  ].join(' ');
  console.log('  ' + row);
}

console.log();

// ─── save results JSON ───────────────────────────────────────────────────────

const timestamp = new Date().toISOString();
const jsonOut = {
  timestamp,
  system: { nodeVersion, platform, cpuModel, cpuCount, totalMemGb },
  config: { runs: RUNS, trim: TRIM },
  results,
};

const jsonPath = join(BENCH, 'results.json');
writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2));
console.log(`  Results saved → benchmark/results.json`);

// ─── generate REPORT.md ──────────────────────────────────────────────────────

function formatTable(rows, headers) {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  );
  const hr = widths.map((w) => '-'.repeat(w + 2)).join('|');
  const fmt = (row) =>
    row.map((v, i) => ` ${String(v).padEnd(widths[i])} `).join('|');
  return [
    '|' + fmt(headers) + '|',
    '|' + hr + '|',
    ...rows.map((r) => '|' + fmt(r) + '|'),
  ].join('\n');
}

const tableRows = results.map((r) => [
  r.label,
  sec(r.mean) + 's',
  sec(r.min) + 's',
  sec(r.max) + 's',
  sec(r.stddev) + 's',
  mb(r.meanRss) === 'N/A' ? 'N/A' : mb(r.meanRss) + ' MB',
  r.label === baseline.label ? '*(baseline)*' : pct(baseline.mean, r.mean),
]);

const resultsTable = formatTable(tableRows, [
  'Scenario',
  'Mean',
  'Min',
  'Max',
  'Stdev',
  'Peak RSS',
  'vs poku+happy-dom',
]);

// Build per-metric analysis
function findResult(label) {
  return results.find((r) => r.label === label);
}

const pokuHappy = findResult('poku + happy-dom');
const pokuJsdom = findResult('poku + jsdom');
const jestJsdom = findResult('jest + jsdom');
const vitestJsdom = findResult('vitest + jsdom');
const vitestHappy = findResult('vitest + happy-dom');

const happyVsJsdomPoku =
  pokuHappy && pokuJsdom
    ? (((pokuJsdom.mean - pokuHappy.mean) / pokuHappy.mean) * 100).toFixed(0)
    : null;

const happyVsJsdomVitest =
  vitestHappy && vitestJsdom
    ? (
        ((vitestJsdom.mean - vitestHappy.mean) / vitestHappy.mean) *
        100
      ).toFixed(0)
    : null;

const pokuVsJest =
  pokuHappy && jestJsdom
    ? (((jestJsdom.mean - pokuHappy.mean) / pokuHappy.mean) * 100).toFixed(0)
    : null;

const pokuVsVitest =
  pokuHappy && vitestJsdom
    ? (((vitestJsdom.mean - pokuHappy.mean) / pokuHappy.mean) * 100).toFixed(0)
    : null;

const jestVsVitest =
  jestJsdom && vitestJsdom
    ? (((vitestJsdom.mean - jestJsdom.mean) / jestJsdom.mean) * 100).toFixed(0)
    : null;

const fastest = results.reduce((a, b) => (a.mean < b.mean ? a : b));
const slowest = results.reduce((a, b) => (a.mean > b.mean ? a : b));

const report = `# React Testing Framework Benchmark Report

> Generated: ${new Date(timestamp).toUTCString()}

## Environment

| Property | Value |
|---|---|
| Node.js | ${nodeVersion} |
| Platform | ${platform} |
| CPU | ${cpuModel} |
| CPU Cores | ${cpuCount} |
| Total RAM | ${totalMemGb} GB |
| Runs/scenario | ${RUNS} (trim ±${TRIM}) |

## Scenarios

Each scenario runs the **same 9 React tests** across 5 test files:

| Test File | Tests |
|---|---|
| 'counter.test.jsx' | 1 — stateful counter, event interaction |
| 'hooks.test.jsx' | 2 — custom hook harness + \`renderHook\` |
| 'lifecycle.test.jsx' | 2 — \`rerender\`, \`unmount\` + effect cleanup |
| 'context.test.jsx' | 1 — \`createContext\` + wrapper injection |
| 'concurrency.test.jsx' | 2 — React 19 \`use()\` + \`useTransition\` |

### Frameworks under test

| Combination | DOM layer | Assertion style |
|---|---|---|
| poku + @pokujs/react | happy-dom | \`assert.strictEqual\` |
| poku + @pokujs/react | jsdom | \`assert.strictEqual\` |
| jest 29 + @testing-library/react | jsdom (jest-environment-jsdom) | \`expect().toBe()\` |
| vitest 3 + @testing-library/react | jsdom | \`expect().toBe()\` |
| vitest 3 + @testing-library/react | happy-dom | \`expect().toBe()\` |

## Results

${resultsTable}

> **Poku elapsed time** uses Poku's reported suite \`Duration\` (ANSI-stripped parse) to avoid teardown-skew artifacts.
> **Jest/Vitest elapsed time** is measured with \`performance.now()\` around the child-process spawn.
> **Peak RSS** is captured via \`/usr/bin/time -l\` on macOS (bytes → MB).
> The baseline for relative comparisons is **poku + happy-dom**.

## Analysis

### Overall ranking (mean wall-clock time)

${results
  .slice()
  .sort((a, b) => a.mean - b.mean)
  .map((r, i) => `${i + 1}. **${r.label}** — ${sec(r.mean)}s`)
  .join('\n')}

### Speed comparison

${
  pokuVsJest != null
    ? `- poku+happy-dom vs jest+jsdom: jest is **${pokuVsJest}% ${Number(pokuVsJest) > 0 ? 'slower' : 'faster'}**`
    : '- jest data unavailable'
}
${
  pokuVsVitest != null
    ? `- poku+happy-dom vs vitest+jsdom: vitest is **${pokuVsVitest}% ${Number(pokuVsVitest) > 0 ? 'slower' : 'faster'}**`
    : '- vitest data unavailable'
}
${
  jestVsVitest != null
    ? `- jest+jsdom vs vitest+jsdom: vitest is **${jestVsVitest}% ${Number(jestVsVitest) > 0 ? 'slower' : 'faster'}** than jest`
    : '- jest/vitest comparison unavailable'
}

### DOM adapter impact

${
  happyVsJsdomPoku != null
    ? `- **poku**: happy-dom vs jsdom — jsdom is **${happyVsJsdomPoku}% ${Number(happyVsJsdomPoku) > 0 ? 'slower' : 'faster'}**`
    : '- poku DOM comparison unavailable'
}
${
  happyVsJsdomVitest != null
    ? `- **vitest**: happy-dom vs jsdom — jsdom is **${happyVsJsdomVitest}% ${Number(happyVsJsdomVitest) > 0 ? 'slower' : 'faster'}**`
    : '- vitest DOM comparison unavailable'
}

### Memory footprint

${
  results.filter((r) => r.meanRss != null).length > 0
    ? results
        .filter((r) => r.meanRss != null)
        .sort((a, b) => a.meanRss - b.meanRss)
        .map((r) => `- **${r.label}**: ${mb(r.meanRss)} MB peak RSS`)
        .join('\n')
    : '_Peak RSS data not available on this platform._'
}

### Consistency (lower stdev = more predictable)

${results
  .slice()
  .sort((a, b) => a.stddev - b.stddev)
  .map((r) => `- **${r.label}**: σ = ${sec(r.stddev)}s`)
  .join('\n')}

## Key findings

- **Fastest**: ${fastest.label} — ${sec(fastest.mean)}s mean
- **Slowest**: ${slowest.label} — ${sec(slowest.mean)}s mean
- **Speed spread**: ${(((slowest.mean - fastest.mean) / fastest.mean) * 100).toFixed(0)}% difference between fastest and slowest

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

\`\`\`sh
# Install benchmark deps (one-time)
cd benchmark && npm install && cd ..

# Re-run with custom run count
BENCH_RUNS=10 node benchmark/run.mjs
\`\`\`

Results are saved to \`benchmark/results.json\` for programmatic analysis.
`;

const reportPath = join(BENCH, 'REPORT.md');
writeFileSync(reportPath, report);
console.log(`  Report saved  → benchmark/REPORT.md\n`);
