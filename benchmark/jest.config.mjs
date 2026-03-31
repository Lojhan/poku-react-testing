export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  testMatch: ['<rootDir>/tests/jest/**/*.test.jsx'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
};
