import * as pokuDom from '@pokujs/dom';
import { assert, describe, it } from 'poku';
import { cleanup, render, screen } from '../src/index.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SCOPE_HOOKS_KEY = Symbol.for('@pokujs/poku.test-scope-hooks');

type ScopeHooks = {
  createHolder: () => { scope: unknown };
  runScoped: (
    holder: { scope: unknown },
    fn: () => Promise<unknown> | unknown
  ) => Promise<void>;
};

const hasDomScopeApi =
  typeof (pokuDom as Record<string, unknown>).defineSlotKey === 'function' &&
  typeof (pokuDom as Record<string, unknown>).getOrCreateScope === 'function';

const testHooksDisabled = async () => {
  let resolveARendered!: () => void;
  let resolveBRendered!: () => void;
  let resolveACleaned!: () => void;

  const aRendered = new Promise<void>((resolve) => {
    resolveARendered = resolve;
  });
  const bRendered = new Promise<void>((resolve) => {
    resolveBRendered = resolve;
  });
  const aCleaned = new Promise<void>((resolve) => {
    resolveACleaned = resolve;
  });

  await Promise.all([
    it('suite A cleanup removes suite B tree when isolation is unavailable', async () => {
      render(<div data-testid='suite-a'>suite-a</div>);
      assert.strictEqual(screen.getByTestId('suite-a').textContent, 'suite-a');

      resolveARendered();
      await bRendered;

      cleanup();
      resolveACleaned();

      assert.throws(() => screen.getByTestId('suite-a'));
    }),

    it('suite B is contaminated by suite A cleanup when isolation is unavailable', async () => {
      render(<div data-testid='suite-b'>suite-b</div>);
      assert.strictEqual(screen.getByTestId('suite-b').textContent, 'suite-b');

      resolveBRendered();
      await aRendered;
      await aCleaned;
      await sleep(0);

      assert.throws(() => screen.getByTestId('suite-b'));
    }),
  ]);
};

const testHooksEnabled = async () => {
  let resolveARendered!: () => void;
  let resolveBRendered!: () => void;
  let resolveACleaned!: () => void;

  const aRendered = new Promise<void>((resolve) => {
    resolveARendered = resolve;
  });
  const bRendered = new Promise<void>((resolve) => {
    resolveBRendered = resolve;
  });
  const aCleaned = new Promise<void>((resolve) => {
    resolveACleaned = resolve;
  });

  await Promise.all([
    it('suite A cleanup does not remove suite B tree', async () => {
      render(<div data-testid='suite-a'>suite-a</div>);
      assert.strictEqual(screen.getByTestId('suite-a').textContent, 'suite-a');

      resolveARendered();
      await bRendered;

      cleanup();
      resolveACleaned();

      assert.throws(() => screen.getByTestId('suite-a'));
    }),

    it('suite B remains mounted while suite A cleans up', async () => {
      render(<div data-testid='suite-b'>suite-b</div>);
      assert.strictEqual(screen.getByTestId('suite-b').textContent, 'suite-b');

      resolveBRendered();
      await aRendered;
      await aCleaned;
      await sleep(0);

      assert.strictEqual(screen.getByTestId('suite-b').textContent, 'suite-b');

      cleanup();
      assert.throws(() => screen.getByTestId('suite-b'));
    }),
  ]);
};

describe('react scope isolation', () => {
  let hasRegisteredHooks = false;

  it('scope-hook contract probe', () => {
    const g = globalThis as Record<symbol, ScopeHooks | undefined>;
    hasRegisteredHooks = typeof g[SCOPE_HOOKS_KEY] === 'object';
    assert.ok(true, 'runtime probe');
  });

  if (!hasRegisteredHooks || !hasDomScopeApi) {
    return it(
      'test hooks are disabled when scope hooks are unavailable',
      testHooksDisabled
    );
  }

  it('test hooks are enabled when scope hooks are available', testHooksEnabled);
});
