import { afterEach, assert, test } from 'poku';
import { createContext, useContext } from 'react';
import { cleanup, render, screen } from '../src/index.ts';

afterEach(cleanup);

const ThemeContext = createContext('light');

const ThemeLabel = () => {
  const theme = useContext(ThemeContext);
  return <p>Theme: {theme}</p>;
};

test('injects context values via wrapper', async () => {
  const ThemeWrapper = ({ children }: { children?: React.ReactNode }) => (
    <ThemeContext.Provider value='dark'>{children}</ThemeContext.Provider>
  );

  render(<ThemeLabel />, { wrapper: ThemeWrapper });

  assert.strictEqual(
    screen.getByText('Theme: dark').textContent,
    'Theme: dark'
  );
});
