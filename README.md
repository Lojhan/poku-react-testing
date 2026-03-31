# poku-react-testing

React testing helpers and a Poku plugin for DOM-backed test execution.

## Features

- Lightweight `render`, `renderHook`, `cleanup`, `screen`, and `fireEvent` helpers.
- Poku plugin that injects TSX loader and DOM setup automatically for `.tsx` and `.jsx` tests.
- DOM adapters:
  - `happy-dom` (default)
  - `jsdom` (optional)
  - custom setup module
- Optional render metrics with configurable reporting.

## Install

```bash
npm install --save-dev poku-react-testing poku react react-dom
```

If you want to run tests with `jsdom`:

```bash
npm install --save-dev jsdom
```

## Usage

### 1) Configure Poku

```ts
import { defineConfig } from 'poku';
import { reactTestingPlugin } from 'poku-react-testing';

export default defineConfig({
  plugins: [
    reactTestingPlugin({
      dom: 'happy-dom',
      domUrl: 'http://localhost:3000/',
      metrics: false,
    }),
  ],
});
```

### 2) Write tests

```tsx
import { afterEach, assert, test } from 'poku';
import { cleanup, render, screen } from 'poku-react-testing';

afterEach(cleanup);

test('renders component', () => {
  render(<h1>Hello</h1>);
  assert.strictEqual(screen.getByRole('heading').textContent, 'Hello');
});
```

## Metrics

Metrics are disabled by default. Enable metrics explicitly:

```ts
reactTestingPlugin({
  metrics: {
    enabled: true,
    topN: 10,
    minDurationMs: 1,
    reporter(summary) {
      console.log(summary.topSlowest);
    },
  },
});
```

`metrics: true` is shorthand for enabling metrics with default options.

## Build and Validate

```bash
npm run check
npm run build
npm pack --dry-run
```

## Release

- Push a tag like `v0.1.0` to trigger publish workflow.
- Set repository secret `NPM_TOKEN` with publish permissions.
