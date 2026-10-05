const { listNotifications, markNotificationRead, markAllNotificationsRead } = require('../services/data');

async function list(req, res) {
  const notifications = await listNotifications(req.user);
  res.json({ notifications: notifications.map(item => ({
    ...item,
    id: String(item._id),
    timestamp: new Date(item.createdAt).getTime(),
    title: ({ new_sos: 'New SOS', accepted: 'SOS Accepted', resolved: 'SOS Resolved', approval: 'Rescuer Approval' })[item.type] || 'Notification'
  })) });
}

async function markRead(req, res) {
  const notification = await markNotificationRead(req.validated.params.id, req.user);
  if (!notification) return res.status(404).json({ error: { message: 'Notification not found.' } });
  res.json({ message: 'Notification marked as read.' });
}

async function markAllRead(req, res) {
  await markAllNotificationsRead(req.user);
  res.json({ message: 'Notifications marked as read.' });
}

module.exports = { list, markRead, markAllRead };
