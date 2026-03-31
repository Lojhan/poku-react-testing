import { Suspense, use, useState, useTransition } from 'react';
import { afterEach, assert, test } from 'poku';
import { cleanup, fireEvent, render, screen } from '../src/index.ts';

afterEach(cleanup);

const ResourceView = ({ resource }: { resource: Promise<string> }) => {
  const value = use(resource);
  return <h2>{value}</h2>;
};

test('renders a resolved use() resource under Suspense', () => {
  const value = 'Loaded from use() resource';
  const resolvedResource = {
    status: 'fulfilled' as const,
    value,
    then: (onFulfilled?: (resolved: string) => unknown) =>
      Promise.resolve(onFulfilled ? onFulfilled(value) : value),
  } as unknown as Promise<string>;

  render(
    <Suspense fallback={<div role="status">Resource pending...</div>}>
      <ResourceView resource={resolvedResource} />
    </Suspense>,
  );

  assert.strictEqual(screen.getByRole('heading', { level: 2 }).textContent, value);
});

test('runs urgent and transition update pipeline', () => {
  const TransitionPipeline = () => {
    const [urgentState, setUrgentState] = useState('idle');
    const [deferredState, setDeferredState] = useState('idle');
    const [isPending, startTransition] = useTransition();

    return (
      <section>
        <button
          type="button"
          onClick={() => {
            setUrgentState('urgent-updated');
            startTransition(() => {
              setDeferredState('transition-updated');
            });
          }}
        >
          Run pipeline
        </button>
        <output aria-label="urgent-state">{urgentState}</output>
        <output aria-label="deferred-state">{deferredState}</output>
        <output aria-label="pending-state">{isPending ? 'pending' : 'settled'}</output>
      </section>
    );
  };

  render(<TransitionPipeline />);

  assert.strictEqual(screen.getByLabelText('urgent-state').textContent, 'idle');
  assert.strictEqual(screen.getByLabelText('deferred-state').textContent, 'idle');

  fireEvent.click(screen.getByRole('button', { name: 'Run pipeline' }));

  assert.strictEqual(screen.getByLabelText('urgent-state').textContent, 'urgent-updated');
  assert.strictEqual(screen.getByLabelText('deferred-state').textContent, 'transition-updated');
});
