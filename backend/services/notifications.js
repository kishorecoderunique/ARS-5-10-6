const { createNotifications: insertNotifications } = require('./data');

async function createNotifications({ app, userIds = [], role = null, type, message, sosId = null }) {
  const created = await insertNotifications({ userIds, role, type, message, sosId });
  const io = app.get('io');
  if (io) created.forEach(item => {
    if (item.userId) io.to(`user:${item.userId}`).emit('notification:new', item);
    else io.to(item.role === 'admin' ? 'admins' : 'rescuers').emit('notification:new', item);
  });
  return created;
}

module.exports = { createNotifications };
