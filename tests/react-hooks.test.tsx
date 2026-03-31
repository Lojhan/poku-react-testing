import { useMemo, useState } from 'react';
import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, renderHook, screen } from '../src/index.ts';

afterEach(cleanup);

const useToggle = (initialValue = false) => {
  const [enabled, setEnabled] = useState(initialValue);
  const toggle = () => setEnabled((current) => !current);

  return useMemo(() => ({ enabled, toggle }), [enabled]);
};

const HookHarness = () => {
  const { enabled, toggle } = useToggle();

  return (
    <div>
      <output aria-label="toggle-state">{enabled ? 'enabled' : 'disabled'}</output>
      <button type="button" onClick={toggle}>
        Toggle
      </button>
    </div>
  );
};

test('tests custom hooks through a component harness', () => {
  render(<HookHarness />);

  assert.strictEqual(screen.getByLabelText('toggle-state').textContent, 'disabled');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
  assert.strictEqual(screen.getByLabelText('toggle-state').textContent, 'enabled');
});

test('tests hook logic directly with renderHook', () => {
  const { result } = renderHook(({ initial }: { initial: boolean }) => useToggle(initial), {
    initialProps: { initial: true },
  });

  assert.strictEqual(result.current.enabled, true);
});
