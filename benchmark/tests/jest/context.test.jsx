import { afterEach, expect, test } from '@jest/globals';
import { cleanup, render, screen } from '@testing-library/react';
import { createContext, useContext } from 'react';

afterEach(cleanup);

const ThemeContext = createContext('light');

const ThemeLabel = () => {
  const theme = useContext(ThemeContext);
  return <p>Theme: {theme}</p>;
};

test('injects context values via wrapper', () => {
  const ThemeWrapper = ({ children }) => (
    <ThemeContext.Provider value='dark'>{children}</ThemeContext.Provider>
  );

  render(<ThemeLabel />, { wrapper: ThemeWrapper });

  expect(screen.getByText('Theme: dark').textContent).toBe('Theme: dark');
});
