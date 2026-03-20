// Set ts-node to use the e2e tsconfig before cucumber loads
process.env.TS_NODE_PROJECT = 'e2e/tsconfig.json';

export default {
  require: ['e2e/steps/**/*.ts', 'e2e/support/**/*.ts'],
  requireModule: ['ts-node/register'],
  format: ['html:e2e/test-results/report.html', 'progress'],
  paths: ['e2e/features/**/*.feature'],
  publishQuiet: true,
};
