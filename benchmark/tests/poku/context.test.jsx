import { afterEach, assert, test } from 'poku';
import { cleanup, render, screen } from '@pokujs/react';
import React, { createContext, useContext } from 'react';

afterEach(cleanup);

const ThemeContext = createContext('light');

const ThemeLabel = () => {
  const theme = useContext(ThemeContext);
  return <p>Theme: {theme}</p>;
};

test('injects context values via wrapper', async () => {
  const ThemeWrapper = ({ children }) => (
    <ThemeContext.Provider value='dark'>{children}</ThemeContext.Provider>
  );

  render(<ThemeLabel />, { wrapper: ThemeWrapper });

  assert.strictEqual(
    screen.getByText('Theme: dark').textContent,
    'Theme: dark'
  );
});
