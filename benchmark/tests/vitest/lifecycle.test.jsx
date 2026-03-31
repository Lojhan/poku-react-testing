import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, expect, test } from 'vitest';

afterEach(cleanup);

const Greeting = ({ name }) => <h3>Hello {name}</h3>;

test('rerender updates component props in place', () => {
  const view = render(<Greeting name='Ada' />);

  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
    'Hello Ada'
  );
  view.rerender(<Greeting name='Grace' />);
  expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(
    'Hello Grace'
  );
});

test('unmount runs effect cleanup logic', () => {
  let cleaned = false;

  const WithEffect = () => {
    useEffect(() => {
      return () => {
        cleaned = true;
      };
    }, []);

    return <span>Mounted</span>;
  };

  const view = render(<WithEffect />);
  expect(cleaned).toBe(false);

  view.unmount();
  expect(cleaned).toBe(true);
});
