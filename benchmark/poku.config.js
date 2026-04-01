import { defineConfig } from 'poku';
import { reactTestingPlugin } from 'poku-react-testing/plugin';

const dom = process.env.POKU_REACT_TEST_DOM;
if (!dom) {
  throw new Error('POKU_REACT_TEST_DOM environment variable is not set');
}

export default defineConfig({
  plugins: [reactTestingPlugin({ dom })],
  isolation: 'none',
});
