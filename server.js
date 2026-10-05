require('dotenv').config({ path: require('path').join(__dirname, '.env') });

if (!process.env.FRONTEND_URL) {
  const deploymentHost = process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_URL;
  if (deploymentHost) process.env.FRONTEND_URL = `https://${deploymentHost}`;
}

const { loadEnv } = require('./backend/config/env');
const { createApplication } = require('./backend/server');
const { connectDatabase } = require('./backend/config/db');

const express = require('express');
const config = loadEnv();
const backendServer = createApplication(config);
const app = express();
let databaseConnection;

app.use('/api', async (req, res, next) => {
  if (!databaseConnection) {
    databaseConnection = connectDatabase(config).catch(error => {
      databaseConnection = null;
      throw error;
    });
  }

  try {
    await databaseConnection;
    next();
  } catch (error) {
    console.error('Supabase connection failed:', error.message);
    if (req.path === '/health') {
      return res.status(503).json({
        ok: false,
        db: 'disconnected',
        message: 'Supabase database is not connected.'
      });
    }
    return res.status(503).json({
      error: { message: 'Database is not connected. Check the server configuration and try again.' }
    });
  }
});
app.use(backendServer.app);

module.exports = app;
