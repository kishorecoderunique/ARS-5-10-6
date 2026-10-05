require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { Server } = require('socket.io');
const { loadEnv } = require('./config/env');
const { connectDatabase, isDatabaseConnected } = require('./config/db');
const { configureSockets } = require('./sockets');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApplication(config = loadEnv()) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.frontendUrl, methods: ['GET', 'POST', 'PATCH'] }
  });
  server.app = app;
  app.locals.config = config;
  app.set('io', io);
  configureSockets(io, config.jwtSecret, config);

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === config.frontendUrl) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS.');
      error.statusCode = 403;
      return callback(error);
    }
  }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (req, res) => {
    const connected = isDatabaseConnected();
    return res.status(connected ? 200 : 503).json({
      ok: connected,
      db: connected ? 'connected' : 'disconnected',
      ...(connected ? {} : { message: 'Supabase database is not connected.' })
    });
  });
  app.use('/api', (req, res, next) => {
    const apiGroup = req.path.split('/')[1];
    if (!['auth', 'sos', 'admin', 'notifications', 'users'].includes(apiGroup)) return next();
    if (isDatabaseConnected()) return next();
    return res.status(503).json({ error: { message: 'Database is not connected. Check the server configuration and try again.' } });
  });
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/sos', require('./routes/sosRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api', (req, res) => res.status(404).json({ message: 'Route not found' }));

  const frontendRoot = path.join(__dirname, '..');
  for (const directory of ['assets', 'data', 'login', 'rescuer', 'admin', 'trigger-sos']) {
    app.use(`/${directory}`, express.static(path.join(frontendRoot, directory), {
      fallthrough: true,
      index: 'index.html'
    }));
  }
  app.get('/', (req, res, next) => {
    res.sendFile(path.join(frontendRoot, 'index.html'), error => {
      if (error) next(error);
    });
  });

  app.use(notFound);
  app.use(errorHandler);
  return server;
}

async function startServer() {
  const config = loadEnv();
  const server = createApplication(config);
  server.listen(config.port, () => {
    console.log(`ARS server listening at http://localhost:${config.port}`);
  });

  try {
    await connectDatabase(config);
    console.log('Supabase connected.');
  } catch (error) {
    console.error(error.message);
  }

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  startServer().catch(error => {
    console.error('Failed to start ARS server:', error.message);
    process.exit(1);
  });
}

module.exports = { createApplication, startServer };
