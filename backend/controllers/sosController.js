const { getSos, listSos, createSos, updateSosConditional, findUser, listUsers } = require('../services/data');
const { reverseGeocode, reverseGeocodeAddress } = require('../services/geocode');
const { createNotifications } = require('../services/notifications');

const severityOrder = { High: 0, Medium: 1, Low: 2 };
const transitions = { accepted: 'en_route', en_route: 'reached', reached: 'resolved' };

function serializeSos(sos) {
  const item = sos.toObject ? sos.toObject() : sos;
  return {
    ...item,
    id: String(item._id),
    _id: String(item._id),
    phone: item.victimPhone,
    timestamp: new Date(item.triggeredAt).getTime(),
    assignedRescuerId: item.acceptedBy?._id ? String(item.acceptedBy._id) : item.acceptedBy ? String(item.acceptedBy) : null,
    assignedRescuerName: item.acceptedBy?.name || null,
    severity: String(item.severity).toLowerCase()
  };
}

async function list(req, res) {
  const records = await listSos({
    status: req.query.status,
    severity: req.query.severity
  });
  records.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity] ||
    new Date(b.triggeredAt) - new Date(a.triggeredAt)
  );
  res.json({ sos: records.map(serializeSos) });
}

async function create(req, res) {
  const input = req.validated.body;
  const geocodedLocation = req.app.locals.config.geocodingKey
    ? await reverseGeocode(req.app.locals.config, input.lat, input.lng)
    : '';
  const locationName = geocodedLocation && geocodedLocation !== 'Unknown location'
    ? geocodedLocation
    : input.locationName || 'Unknown location';
  const now = new Date().toISOString();
  const sos = await createSos({
    victimName: input.victimName,
    victimPhone: input.victimPhone,
    lat: input.lat,
    lng: input.lng,
    severity: input.severity[0].toUpperCase() + input.severity.slice(1).toLowerCase(),
    description: input.description,
    locationName,
    status: 'pending',
    history: [{ status: 'pending', changedAt: now }]
  });
  const rescuers = await listUsers({ role: 'rescuer', status: 'approved', duty: 'on' });
  await createNotifications({
    app: req.app,
    userIds: rescuers.map(user => user._id),
    type: 'new_sos',
    message: `${sos.victimName} reported an emergency at ${sos.locationName}.`,
    sosId: sos._id
  });
  await createNotifications({
    app: req.app, role: 'admin', type: 'new_sos',
    message: `${sos.victimName} reported an emergency at ${sos.locationName}.`, sosId: sos._id
  });
  const payload = serializeSos(sos);
  req.app.get('io').to(['admins', 'rescuers']).emit('sos:new', payload);
  res.status(201).json({ sos: payload });
}

async function mine(req, res) {
  const records = await listSos({ acceptedBy: req.user.id });
  res.json({ sos: records.map(serializeSos) });
}

async function location(req, res) {
  const sos = await getSos(req.validated.params.id);
  if (!sos) return res.status(404).json({ error: { message: 'SOS not found.' } });

  const result = await reverseGeocodeAddress(req.app.locals.config, sos.lat, sos.lng);
  res.json({
    address: result?.address || null,
    provider: result?.provider || null,
    lat: sos.lat,
    lng: sos.lng
  });
}

async function accept(req, res) {
  const id = req.validated.params.id;
  const sos = await updateSosConditional(
    id,
    { status: 'pending' },
    { status: 'accepted', acceptedBy: req.user.id, acceptedAt: new Date().toISOString() },
    { status: 'accepted', changedAt: new Date().toISOString(), changedBy: req.user.id }
  );
  if (!sos) return res.status(409).json({ error: { message: 'This SOS has already been accepted or is unavailable.' } });
  const acceptedBy = await findUser({ id: req.user.id });
  sos.acceptedBy = acceptedBy;
  const payload = serializeSos(sos);
  await createNotifications({
    app: req.app, role: 'admin', type: 'accepted',
    message: `${acceptedBy.name} accepted the SOS at ${sos.locationName}.`, sosId: sos._id
  });
  req.app.get('io').to(['admins', 'rescuers']).emit('sos:accepted', payload);
  res.json({ sos: payload });
}

async function updateStatus(req, res) {
  const { id } = req.validated.params;
  const { status } = req.validated.body;
  const current = await getSos(id);
  if (!current) return res.status(404).json({ error: { message: 'SOS not found.' } });
  if (String(current.acceptedBy) !== req.user.id) return res.status(403).json({ error: { message: 'Only the assigned rescuer can update this SOS.' } });
  if (transitions[current.status] !== status) return res.status(409).json({ error: { message: 'SOS status must advance one step at a time.' } });

  const now = new Date().toISOString();
  const updated = await updateSosConditional(
    id,
    { status: current.status, acceptedBy: req.user.id },
    { status, ...(status === 'resolved' ? { resolvedAt: now } : {}) },
    { status, changedAt: now, changedBy: req.user.id }
  );
  if (!updated) return res.status(409).json({ error: { message: 'SOS changed while you were updating it. Refresh and try again.' } });
  const assigned = await findUser({ id: req.user.id });
  updated.acceptedBy = assigned;
  const payload = serializeSos(updated);
  if (status === 'resolved') {
    await createNotifications({
      app: req.app, role: 'admin', type: 'resolved',
      message: `The SOS at ${updated.locationName} has been resolved.`, sosId: updated._id
    });
  }
  req.app.get('io').to(['admins', 'rescuers']).emit('sos:status', payload);
  res.json({ sos: payload });
}

async function assign(req, res) {
  const { id } = req.validated.params;
  const { rescuerId } = req.validated.body;
  const current = await getSos(id);
  if (!current) return res.status(404).json({ error: { message: 'SOS not found.' } });
  if (['resolved', 'cancelled'].includes(current.status)) {
    return res.status(409).json({ error: { message: 'A resolved or cancelled SOS cannot be reassigned.' } });
  }
  const rescuer = rescuerId ? await findUser({ id: rescuerId, role: 'rescuer', status: 'approved' }) : null;
  if (rescuerId && !rescuer) return res.status(404).json({ error: { message: 'Approved rescuer not found.' } });
  const now = new Date().toISOString();
  const nextStatus = rescuer ? (current.status === 'pending' ? 'accepted' : current.status) : 'pending';
  const changes = rescuer
    ? { acceptedBy: rescuer._id, acceptedAt: current.acceptedAt || now, status: nextStatus }
    : { acceptedBy: null, acceptedAt: null, status: nextStatus };
  const updated = await updateSosConditional(
    id,
    { status: current.status, acceptedBy: current.acceptedBy },
    changes,
    nextStatus !== current.status
      ? { status: nextStatus, changedAt: now, changedBy: req.user.id }
      : null
  );
  if (!updated) return res.status(409).json({ error: { message: 'SOS changed while you were updating it. Refresh and try again.' } });
  updated.acceptedBy = rescuer;
  const payload = serializeSos(updated);
  const eventName = payload.status === 'pending' ? 'sos:status' : 'sos:accepted';
  req.app.get('io').to(['admins', 'rescuers']).emit(eventName, payload);
  res.json({ sos: payload });
}

module.exports = { list, create, mine, location, accept, updateStatus, assign };
