<div align="center">
<img height="180" alt="Poku's Logo" src="https://raw.githubusercontent.com/wellwelwel/poku/main/.github/assets/readme/poku.svg">

# poku-react-testing

Enjoying **Poku**? [Give him a star to show your support](https://github.com/wellwelwel/poku) 🌟

---

📘 [**Documentation**](https://github.com/Lojhan/poku-react-testing#readme)

</div>

---

🧪 [**poku-react-testing**](https://github.com/Lojhan/poku-react-testing) is a **Poku** plugin for React component testing with DOM adapters.

> [!TIP]
>
> Render React components in isolated test files — automatic TSX loader injection, DOM environment setup, and optional render metrics included.

---

## Quickstart

### Install

<table>
<tr>
<td width="225">

```bash
# Node.js
npm i -D poku-react-testing
```

</td>
<td width="225">

```bash
# Bun
bun add -d poku-react-testing
```

</td>
<td width="225">

```bash
# Deno (optional)
deno add npm:poku-react-testing
```

</td>
</tr>
</table>

Install a DOM adapter (at least one is required):

<table>
<tr>
<td width="225">

```bash
# happy-dom (recommended)
npm i -D happy-dom \
  @happy-dom/global-registrator
```

</td>
<td width="225">

```bash
# jsdom
npm i -D jsdom
```

</td>
</tr>
</table>

### Enable the Plugin

```js
// poku.config.js
import { defineConfig } from 'poku';
import { reactTestingPlugin } from 'poku-react-testing/plugin';

export default defineConfig({
  plugins: [
    reactTestingPlugin({
      dom: 'happy-dom',
    }),
  ],
});
```

### Write Tests

```tsx
// tests/my-component.test.tsx
import { afterEach, assert, test } from 'poku';
import { cleanup, render, screen } from 'poku-react-testing';

afterEach(cleanup);

test('renders a heading', () => {
  render(<h1>Hello</h1>);
  assert.strictEqual(screen.getByRole('heading').textContent, 'Hello');
});
```

---

## Compatibility

### Runtime × DOM Adapter

| | Node.js ≥ 20 | Bun ≥ 1 | Deno ≥ 2 |
|---|:---:|:---:|:---:|
| **happy-dom** | ✅ | ✅ | ✅ |
| **jsdom** | ✅ | ✅ | ⚠️ |
| **custom setup** | ✅ | ✅ | ✅ |

> [!NOTE]
>
> `jsdom` under Deno may be unstable depending on Deno's npm compatibility layer for the current `jsdom` version. For Deno projects, prefer `happy-dom`.

---

## Options

```ts
reactTestingPlugin({
  /**
   * DOM adapter to use. Defaults to 'happy-dom'.
   * - 'happy-dom'       — fast, recommended for most tests
   * - 'jsdom'           — broader browser API coverage
   * - { setupModule }   — path to a custom DOM setup module
   */
  dom: 'happy-dom',

  /** Base URL assigned to the DOM environment. */
  domUrl: 'http://localhost:3000/',

  /**
   * Render metrics. Disabled by default.
   * Pass `true` for defaults, or an object for fine-grained control.
   */
  metrics: {
    enabled: true,
    topN: 5,
    minDurationMs: 0,
    reporter(summary) {
      console.log(summary.topSlowest);
    },
  },
});
```

---

## License

[MIT](./LICENSE)
