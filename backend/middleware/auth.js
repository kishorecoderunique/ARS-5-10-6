const jwt = require('jsonwebtoken');
const { getUser, findUser } = require('../services/data');

function isLoopbackAddress(address = '') {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

async function authenticateLocalDemo(req, res, next) {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: { message: 'Local demo access is only available from this computer.' } });
  }
  const role = req.get('x-ars-demo-role');
  if (!['admin', 'rescuer'].includes(role)) {
    return res.status(400).json({ error: { message: 'Select an admin or rescuer dashboard role.' } });
  }
  try {
    let user = req.get('x-ars-demo-user')
      ? await getUser(req.get('x-ars-demo-user'))
      : null;
    if (user && (user.role !== role || user.status !== 'approved')) user = null;
    if (!user) {
      user = await findUser({
        role,
        status: 'approved',
        ...(role === 'rescuer' ? { duty: 'on' } : {})
      });
    }
    if (!user) {
      return res.status(503).json({ error: { message: `No approved ${role} account is available. Seed the Supabase database first.` } });
    }
    req.user = { id: String(user._id), role: user.role, name: user.name };
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (req.app.locals.config.localDemoMode) {
    authenticateLocalDemo(req, res, next);
    return;
  }
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  let payload;
  try {
    payload = jwt.verify(token, req.app.locals.config.jwtSecret);
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  getUser(payload.id).then(user => {
    if (!user || user.role !== payload.role || user.status !== 'approved') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.user = { id: String(user._id), role: user.role, name: user.name };
    next();
  }).catch(next);
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: { message: 'You do not have permission to perform this action.' } });
    }
    next();
  };
}

function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: { message: 'You do not have permission to perform this action.' } });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireAnyRole, isLoopbackAddress };
