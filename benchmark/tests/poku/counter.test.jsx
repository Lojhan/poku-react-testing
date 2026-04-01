import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, screen } from 'poku-react-testing';
import React, { useState } from 'react';

afterEach(cleanup);

const Counter = ({ initialCount = 0 }) => {
  const [count, setCount] = useState(initialCount);

  return (
    <section>
      <h1>Count: {count}</h1>
      <button type='button' onClick={() => setCount((v) => v + 1)}>
        Increment
      </button>
    </section>
  );
};

test('renders and updates a React component', async () => {
  render(<Counter initialCount={1} />);

  assert.strictEqual(
    screen.getByRole('heading', { name: 'Count: 1' }).textContent,
    'Count: 1'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
  assert.strictEqual(screen.getByRole('heading').textContent, 'Count: 2');
});
