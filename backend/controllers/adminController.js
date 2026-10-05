const { listUsers, listSos, updateUser, updateSosConditional, countSos, countUsers } = require('../services/data');
const { createNotifications } = require('../services/notifications');

async function rescuers(req, res) {
  const [people, activeCases] = await Promise.all([
    listUsers({ role: 'rescuer' }),
    listSos({ statuses: ['accepted', 'en_route', 'reached'] })
  ]);
  const caseByUser = new Map(activeCases.map(item => [String(item.acceptedBy?._id || item.acceptedBy), item]));
  res.json({ rescuers: people.map(person => ({
    id: String(person._id),
    name: person.name,
    phone: person.phone,
    status: person.status,
    duty: person.duty,
    assignedSosId: caseByUser.get(String(person._id))?._id || null,
    assignedSosLocation: caseByUser.get(String(person._id))?.locationName || null
  })) });
}

async function updateRescuerStatus(req, res, status) {
  const user = await updateUser(req.validated.params.id, {
    status,
    ...(status !== 'approved' ? { duty: 'off' } : {})
  }, { role: 'rescuer' });
  if (!user) return res.status(404).json({ error: { message: 'Rescuer not found.' } });
  if (status === 'rejected') {
    const cases = await listSos({
      acceptedBy: user._id,
      statuses: ['accepted', 'en_route', 'reached']
    });
    for (const sos of cases) {
      const reopened = await updateSosConditional(
        sos._id,
        { status: sos.status, acceptedBy: user._id },
        { status: 'pending', acceptedBy: null, acceptedAt: null },
        { status: 'pending', changedAt: new Date().toISOString(), changedBy: req.user.id }
      );
      if (reopened) req.app.get('io').to(['admins', 'rescuers']).emit('sos:status', {
        id: String(reopened._id),
        _id: String(reopened._id),
        status: reopened.status,
        assignedRescuerId: null
      });
    }
  }
  const event = { id: String(user._id), status: user.status, duty: user.duty, name: user.name };
  req.app.get('io').to(['admins', 'rescuers']).emit('rescuer:duty', event);
  await createNotifications({
    app: req.app, userIds: [user._id], type: 'approval',
    message: status === 'approved' ? 'Your rescuer account was approved.' : 'Your rescuer account was rejected.'
  });
  res.json({ rescuer: event });
}

async function approve(req, res) {
  return updateRescuerStatus(req, res, 'approved');
}

async function reject(req, res) {
  return updateRescuerStatus(req, res, 'rejected');
}

async function stats(req, res) {
  const [totalSos, pending, accepted, resolved, rescuersOnDuty] = await Promise.all([
    countSos(),
    countSos({ status: 'pending' }),
    countSos({ statuses: ['accepted', 'en_route', 'reached'] }),
    countSos({ status: 'resolved' }),
    countUsers({ role: 'rescuer', status: 'approved', duty: 'on' })
  ]);
  res.json({ stats: { totalSos, pending, accepted, resolved, rescuersOnDuty } });
}

async function setDuty(req, res) {
  const user = await updateUser(req.user.id, { duty: req.validated.body.duty }, {
    role: 'rescuer',
    status: 'approved'
  });
  if (!user) return res.status(404).json({ error: { message: 'Approved rescuer not found.' } });
  const event = { id: String(user._id), duty: user.duty, name: user.name };
  req.app.get('io').to(['admins', 'rescuers']).emit('rescuer:duty', event);
  res.json({ user: { id: event.id, duty: user.duty } });
}

module.exports = { rescuers, approve, reject, stats, setDuty };
