import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';

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

test('renders and updates a React component', () => {
  render(<Counter initialCount={1} />);

  expect(screen.getByRole('heading', { name: 'Count: 1' }).textContent).toBe(
    'Count: 1'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Increment' }));
  expect(screen.getByRole('heading').textContent).toBe('Count: 2');
});
