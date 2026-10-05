const { getDatabase } = require('../config/db');

function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}

function withId(row) {
  return row ? { ...row, _id: row.id } : null;
}

function userFilters(query, filters = {}) {
  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.duty) query = query.eq('duty', filters.duty);
  if (filters.id) query = query.eq('id', filters.id);
  if (filters.ids) query = query.in('id', filters.ids);
  if (filters.phone) query = query.eq('phone', filters.phone);
  return query;
}

async function getUser(id) {
  const row = checked(await getDatabase().from('users').select('*').eq('id', id).maybeSingle());
  return withId(row);
}

async function findUser(filters = {}) {
  const query = userFilters(getDatabase().from('users').select('*'), filters);
  const row = checked(await query.limit(1).maybeSingle());
  return withId(row);
}

async function listUsers(filters = {}) {
  const query = userFilters(getDatabase().from('users').select('*'), filters);
  return checked(await query.order('createdAt', { ascending: true })).map(withId);
}

async function createUser(user) {
  const row = checked(await getDatabase().from('users').insert(user).select('*').single());
  return withId(row);
}

async function updateUser(id, changes, filters = {}) {
  let query = userFilters(getDatabase().from('users').update(changes), { ...filters, id });
  const row = checked(await query.select('*').maybeSingle());
  return withId(row);
}

async function countUsers(filters = {}) {
  let query = userFilters(getDatabase().from('users').select('id', { count: 'exact', head: true }), filters);
  const result = await query;
  if (result.error) throw result.error;
  return result.count || 0;
}

function mapSos(row) {
  return row ? { ...row, _id: row.id } : null;
}

async function getSos(id) {
  return mapSos(checked(await getDatabase().from('sos').select('*').eq('id', id).maybeSingle()));
}

async function listSos(filters = {}) {
  let query = getDatabase().from('sos').select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.acceptedBy) query = query.eq('acceptedBy', filters.acceptedBy);
  if (filters.statuses) query = query.in('status', filters.statuses);
  const rows = checked(await query.order('triggeredAt', { ascending: false }));
  const records = rows.map(mapSos);
  const rescuerIds = [...new Set(records.map(item => item.acceptedBy).filter(Boolean))];
  if (rescuerIds.length) {
    const rescuers = await listUsers({ ids: rescuerIds });
    const byId = new Map(rescuers.map(user => [user._id, user]));
    records.forEach(item => {
      if (item.acceptedBy) {
        const rescuer = byId.get(item.acceptedBy);
        item.acceptedBy = rescuer
          ? { _id: rescuer._id, name: rescuer.name, phone: rescuer.phone }
          : item.acceptedBy;
      }
    });
  }
  return records;
}

async function createSos(sos) {
  return mapSos(checked(await getDatabase().from('sos').insert(sos).select('*').single()));
}

async function updateSosConditional(id, expected, changes, historyEntry) {
  const current = await getSos(id);
  if (!current || current.status !== expected.status) return null;
  if (Object.prototype.hasOwnProperty.call(expected, 'acceptedBy')
    && String(current.acceptedBy || '') !== String(expected.acceptedBy || '')) return null;

  const update = { ...changes };
  if (historyEntry) update.history = [...(current.history || []), historyEntry];
  let query = getDatabase().from('sos').update(update).eq('id', id).eq('status', expected.status);
  if (Object.prototype.hasOwnProperty.call(expected, 'acceptedBy')) {
    query = expected.acceptedBy ? query.eq('acceptedBy', expected.acceptedBy) : query.is('acceptedBy', null);
  }
  return mapSos(checked(await query.select('*').maybeSingle()));
}

async function countSos(filters = {}) {
  let query = getDatabase().from('sos').select('id', { count: 'exact', head: true });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.statuses) query = query.in('status', filters.statuses);
  const result = await query;
  if (result.error) throw result.error;
  return result.count || 0;
}

async function deleteAllSos() {
  checked(await getDatabase().from('sos').delete().not('id', 'is', null));
}

async function createNotifications({ userIds = [], role = null, type, message, sosId = null }) {
  const ids = [...new Set(userIds.map(String))];
  const rows = role
    ? [{ role, type, message, sosId }]
    : ids.map(userId => ({ userId, type, message, sosId }));
  if (!rows.length) return [];
  return checked(await getDatabase().from('notifications').insert(rows).select('*'));
}

async function listNotifications(user) {
  const role = user.role;
  const rows = checked(await getDatabase()
    .from('notifications')
    .select('*')
    .or(`role.eq.${role},userId.eq.${user.id}`)
    .order('createdAt', { ascending: false })
    .limit(100));
  return rows.map(withId);
}

async function markNotificationRead(id, user) {
  const row = checked(await getDatabase()
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .or(`role.eq.${user.role},userId.eq.${user.id}`)
    .select('*')
    .maybeSingle());
  return withId(row);
}

async function markAllNotificationsRead(user) {
  checked(await getDatabase()
    .from('notifications')
    .update({ read: true })
    .or(`role.eq.${user.role},userId.eq.${user.id}`));
}

async function reserveOtp(phone, purpose, otpHash, now) {
  const rows = checked(await getDatabase().rpc('reserve_otp', {
    p_phone: phone,
    p_purpose: purpose,
    p_otp_hash: otpHash,
    p_now: now.toISOString()
  }));
  return withId(rows?.[0] || null);
}

async function incrementOtpAttempts(phone, purpose, now, requireVerified) {
  const rows = checked(await getDatabase().rpc('increment_otp_attempts', {
    p_phone: phone,
    p_purpose: purpose,
    p_now: now.toISOString(),
    p_require_verified: requireVerified
  }));
  return withId(rows?.[0] || null);
}

async function markOtpVerified(id, now) {
  const row = checked(await getDatabase()
    .from('otps')
    .update({ verifiedAt: now.toISOString() })
    .eq('id', id)
    .gt('expiresAt', now.toISOString())
    .select('*')
    .maybeSingle());
  return withId(row);
}

async function deleteOtp(id) {
  checked(await getDatabase().from('otps').delete().eq('id', id));
}

module.exports = {
  getUser,
  findUser,
  listUsers,
  createUser,
  updateUser,
  countUsers,
  getSos,
  listSos,
  createSos,
  updateSosConditional,
  countSos,
  deleteAllSos,
  createNotifications,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  reserveOtp,
  incrementOtpAttempts,
  markOtpVerified,
  deleteOtp
};
