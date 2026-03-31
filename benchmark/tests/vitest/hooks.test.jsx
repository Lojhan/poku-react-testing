import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { useMemo, useState } from 'react';
import { afterEach, expect, test } from 'vitest';

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
      <output aria-label='toggle-state'>
        {enabled ? 'enabled' : 'disabled'}
      </output>
      <button type='button' onClick={toggle}>
        Toggle
      </button>
    </div>
  );
};

test('tests custom hooks through a component harness', () => {
  render(<HookHarness />);

  expect(screen.getByLabelText('toggle-state').textContent).toBe('disabled');
  fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
  expect(screen.getByLabelText('toggle-state').textContent).toBe('enabled');
});

test('tests hook logic directly with renderHook', () => {
  const { result } = renderHook(({ initial }) => useToggle(initial), {
    initialProps: { initial: true },
  });

  expect(result.current.enabled).toBe(true);
});
