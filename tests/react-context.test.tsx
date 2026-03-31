import { createContext, useContext } from 'react';
import { afterEach, assert, test } from 'poku';
import { cleanup, render, screen } from '../src/index.ts';

afterEach(cleanup);

const ThemeContext = createContext('light');

const ThemeLabel = () => {
  const theme = useContext(ThemeContext);
  return <p>Theme: {theme}</p>;
};

test('injects context values via wrapper', () => {
  const ThemeWrapper = ({ children }: { children?: React.ReactNode }) => (
    <ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
  );

  render(<ThemeLabel />, { wrapper: ThemeWrapper });

  assert.strictEqual(screen.getByText('Theme: dark').textContent, 'Theme: dark');
});
