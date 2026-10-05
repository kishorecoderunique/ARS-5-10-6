const jwt = require('jsonwebtoken');
const { getUser, findUser } = require('../services/data');
const { isLoopbackAddress } = require('../middleware/auth');

function configureSockets(io, secret, config) {
  io.use((socket, next) => {
    if (config.localDemoMode) {
      if (!isLoopbackAddress(socket.handshake.address)) {
        return next(new Error('Local demo access is only available from this computer.'));
      }
      const { role, userId } = socket.handshake.auth || {};
      if (!['admin', 'rescuer'].includes(role)) return next(new Error('Select an admin or rescuer dashboard role.'));
      const userLookup = userId
        ? getUser(userId).then(user => user?.role === role && user.status === 'approved' ? user : null)
        : findUser({ role, status: 'approved', ...(role === 'rescuer' ? { duty: 'on' } : {}) });
      return userLookup.then(user => {
        if (!user) return next(new Error(`No approved ${role} account is available.`));
        socket.user = { id: String(user._id), role: user.role };
        next();
      }).catch(next);
    }
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required.'));
      const payload = jwt.verify(token, secret);
      getUser(payload.id).then(user => {
        if (!user || user.role !== payload.role || user.status !== 'approved') {
          return next(new Error('Session is no longer valid.'));
        }
        socket.user = { id: String(user._id), role: user.role };
        next();
      }).catch(next);
    } catch {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', socket => {
    socket.join(`user:${socket.user.id}`);
    socket.join(socket.user.role === 'admin' ? 'admins' : 'rescuers');
  });
}

module.exports = { configureSockets };
