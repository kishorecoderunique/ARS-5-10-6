require('dotenv').config({ path: require('path').join(__dirname, '.env') });

if (!process.env.FRONTEND_URL) {
  const deploymentHost = process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
  if (deploymentHost) process.env.FRONTEND_URL = `https://${deploymentHost}`;
}

const { loadEnv } = require('./backend/config/env');
const { createApplication } = require('./backend/server');

module.exports = createApplication(loadEnv());
