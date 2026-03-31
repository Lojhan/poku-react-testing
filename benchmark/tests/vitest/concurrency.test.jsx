import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Suspense, use, useState, useTransition } from 'react';
import { afterEach, expect, test } from 'vitest';

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

  expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(value);
});

test('runs urgent and transition update pipeline', () => {
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

  expect(screen.getByLabelText('urgent-state').textContent).toBe('idle');
  expect(screen.getByLabelText('deferred-state').textContent).toBe('idle');

  fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));

  expect(screen.getByLabelText('urgent-state').textContent).toBe(
    'urgent-updated'
  );
  expect(screen.getByLabelText('deferred-state').textContent).toBe(
    'transition-updated'
  );
});
