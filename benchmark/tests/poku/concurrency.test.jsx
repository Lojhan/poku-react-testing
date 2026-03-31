import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, screen } from 'poku-react-testing';
import React, { Suspense, use, useState, useTransition } from 'react';

afterEach(cleanup);

const ResourceView = ({ resource }) => {
  const value = use(resource);
  return <h2>{value}</h2>;
};

test('renders a resolved use() resource under Suspense', () => {
  const value = 'Loaded from use() resource';
  const resolvedResource = {
    status: 'fulfilled',
    value,
    then: (onFulfilled) =>
      Promise.resolve(onFulfilled ? onFulfilled(value) : value),
  };

  render(
    <Suspense fallback={<div role='status'>Resource pending...</div>}>
      <ResourceView resource={resolvedResource} />
    </Suspense>
  );

  assert.strictEqual(
    screen.getByRole('heading', { level: 2 }).textContent,
    value
  );
});

await test('runs urgent and transition update pipeline', async () => {
  const TransitionPipeline = () => {
    const [urgentState, setUrgentState] = useState('idle');
    const [deferredState, setDeferredState] = useState('idle');
    const [isPending, startTransition] = useTransition();

    return (
      <section>
        <button
          type='button'
          onClick={() => {
            setUrgentState('urgent-updated');
            startTransition(() => {
              setDeferredState('transition-updated');
            });
          }}
        >
          Run pipeline
        </button>
        <output aria-label='urgent-state'>{urgentState}</output>
        <output aria-label='deferred-state'>{deferredState}</output>
        <output aria-label='pending-state'>
          {isPending ? 'pending' : 'settled'}
        </output>
      </section>
    );
  };

  render(<TransitionPipeline />);

  assert.strictEqual(screen.getByLabelText('urgent-state').textContent, 'idle');
  assert.strictEqual(
    screen.getByLabelText('deferred-state').textContent,
    'idle'
  );

  fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));

  assert.strictEqual(
    screen.getByLabelText('urgent-state').textContent,
    'urgent-updated'
  );
  assert.strictEqual(
    screen.getByLabelText('deferred-state').textContent,
    'transition-updated'
  );
});
