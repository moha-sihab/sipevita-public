const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  console.log(`SIPEVITA backend listening on port ${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

module.exports = server;
