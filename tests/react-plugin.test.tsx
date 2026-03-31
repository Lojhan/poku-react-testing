import { useState } from 'react';
import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';
    
afterEach(cleanup);

type CounterProps = {
  initialCount?: number;
};

const Counter = ({ initialCount = 0 }: CounterProps) => {
  const [count, setCount] = useState(initialCount);

  function increment() {
    setCount((value) => value + 1);
  }

  return (
    <section>
      <h1>Count: {count}</h1>
      <button type="button" onClick={increment}>
        Increment
      </button>
    </section>
  );
};


test('renders and updates a React component', () => {
  render(<Counter initialCount={1} />);

  assert.strictEqual(screen.getByRole('heading', { name: 'Count: 1' }).textContent, 'Count: 1');

  fireEvent.click(screen.getByRole('button', { name: 'Increment' }));

  assert.strictEqual(screen.getByRole('heading').textContent, 'Count: 2');
});
