import { afterEach, assert, test } from 'poku';
import { cleanup, render, screen } from '@pokujs/react';
import React, { useEffect } from 'react';

afterEach(cleanup);

const Greeting = ({ name }) => <h3>Hello {name}</h3>;

test('rerender updates component props in place', async () => {
  const view = render(<Greeting name='Ada' />);

  assert.strictEqual(
    screen.getByRole('heading', { level: 3 }).textContent,
    'Hello Ada'
  );
  view.rerender(<Greeting name='Grace' />);
  assert.strictEqual(
    screen.getByRole('heading', { level: 3 }).textContent,
    'Hello Grace'
  );
});

test('unmount runs effect cleanup logic', async () => {
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
  assert.strictEqual(cleaned, false);

  view.unmount();
  assert.strictEqual(cleaned, true);
});
