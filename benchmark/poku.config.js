import { defineConfig } from 'poku';
import { reactTestingPlugin } from 'poku-react-testing/plugin';

const configuredDom = process.env.POKU_REACT_TEST_DOM;
const dom = configuredDom === 'jsdom' ? 'jsdom' : 'happy-dom';

export default defineConfig({
  plugins: [reactTestingPlugin({ dom })],
});
