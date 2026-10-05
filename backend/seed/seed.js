require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const bcrypt = require('bcryptjs');
const { loadEnv } = require('../config/env');
const { connectDatabase } = require('../config/db');
const { findUser, createUser, updateUser, deleteAllSos, createSos } = require('../services/data');

const rescuers = [
  ['Ramesh Kumar', '9840123456'],
  ['Priya Sharma', '9840234567'],
  ['Vijay K', '9840345678'],
  ['Anitha R', '9840456789'],
  ['Karthik M', '9840567890']
];

const cases = [
  ['Subhashini Nathan', '9790811223', 12.9759, 80.2212, 'High', 'Velachery Main Road', 'Severe urban flooding; immediate evacuation required.'],
  ['Murugan Selvam', '9444155667', 13.038, 80.2785, 'High', 'Marina Beach Lighthouse', 'Fishing vessel in distress near the shore.'],
  ['Deepak Raj', '9884099887', 13.0418, 80.2341, 'High', 'Ranganathan Street, T. Nagar', 'Basement flooding with an electrical hazard.'],
  ['Lakshmi Narayanan', '9176033445', 13.0012, 80.2565, 'Medium', 'Besant Avenue, Adyar', 'Tree blocking a residential evacuation route.'],
  ['Kavitha Sundaram', '9841077889', 13.0067, 80.202, 'Medium', 'Guindy Industrial Estate', 'Workers stranded by rising water.'],
  ['Arun Prakash', '9003122334', 13.0339, 80.2694, 'Medium', 'Mylapore Tank Area', 'Vehicle stranded in floodwater.'],
  ['Meenakshi Sundari', '9840044556', 12.9249, 80.1, 'Low', 'Tambaram Railway Colony', 'Request for drinking water after a power outage.'],
  ['Ganesh Moorthy', '9710066778', 13.085, 80.2101, 'Low', 'Anna Nagar Tower Park', 'Animal rescue requested near a storm drain.']
];

async function saveUser(attributes) {
  const existing = await findUser({ phone: attributes.phone });
  return existing
    ? updateUser(existing._id, attributes)
    : createUser(attributes);
}

async function seed() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const rescuerPassword = process.env.SEED_RESCUER_PASSWORD;
  if (!adminPassword || !rescuerPassword) {
    throw new Error('Set SEED_ADMIN_PASSWORD and SEED_RESCUER_PASSWORD before seeding.');
  }
  const config = loadEnv();
  await connectDatabase(config);

  const admin = await saveUser({
    name: 'ARS Control Room Admin',
    phone: '9000000001',
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: 'admin',
    status: 'approved',
    duty: 'off'
  });
  const createdRescuers = [];
  for (const [name, phone] of rescuers) {
    createdRescuers.push(await saveUser({
      name,
      phone,
      passwordHash: await bcrypt.hash(rescuerPassword, 12),
      role: 'rescuer',
      status: 'approved',
      duty: 'on'
    }));
  }

  await deleteAllSos();
  for (const [index, [victimName, victimPhone, lat, lng, severity, locationName, description]] of cases.entries()) {
    const now = Date.now();
    const status = index === 0 ? 'accepted' : index === 7 ? 'resolved' : 'pending';
    const triggeredAt = new Date(now - (index + 1) * 7 * 60 * 1000).toISOString();
    await createSos({
      victimName,
      victimPhone,
      lat,
      lng,
      severity,
      locationName,
      description,
      status,
      acceptedBy: index === 0 ? createdRescuers[0]._id : index === 7 ? createdRescuers[1]._id : null,
      triggeredAt,
      acceptedAt: index === 0 ? new Date(now - 5 * 60 * 1000).toISOString() : null,
      resolvedAt: index === 7 ? new Date(now - 2 * 60 * 1000).toISOString() : null,
      history: index === 0
        ? [{ status: 'pending', changedAt: triggeredAt }, { status: 'accepted', changedAt: new Date(now - 5 * 60 * 1000).toISOString(), changedBy: createdRescuers[0]._id }]
        : index === 7
          ? [{ status: 'pending', changedAt: triggeredAt }, { status: 'resolved', changedAt: new Date(now - 2 * 60 * 1000).toISOString(), changedBy: createdRescuers[1]._id }]
          : [{ status: 'pending', changedAt: triggeredAt }]
    });
  }

  console.log(`Seed complete. Admin phone: ${admin.phone}; seeded five approved rescuers.`);
}

seed().catch(error => {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
});
