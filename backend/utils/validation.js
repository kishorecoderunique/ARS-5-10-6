const { z } = require('zod');
const { normalizePhone } = require('./phone');

const phone = z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{10}$/, 'Phone must contain 10 digits.'));
const id = z.string().uuid('Invalid ID.');

const schemas = {
  login: z.object({ body: z.object({
    phone,
    password: z.string().min(8).max(128),
    role: z.enum(['admin', 'rescuer'])
  }) }),
  signup: z.object({ body: z.object({
    name: z.string().trim().min(2).max(100),
    phone,
    password: z.string().min(8).max(128)
  }) }),
  otpRequest: z.object({ body: z.object({ phone }) }),
  otpVerify: z.object({ body: z.object({ phone, otp: z.string().regex(/^\d{6}$/) }) }),
  otpReset: z.object({ body: z.object({
    phone,
    otp: z.string().regex(/^\d{6}$/),
    password: z.string().min(8).max(128)
  }) }),
  createSos: z.object({ body: z.object({
    victimName: z.string().trim().min(2).max(100),
    victimPhone: phone,
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    locationName: z.string().trim().min(1).max(200).optional(),
    severity: z.enum(['High', 'Medium', 'Low', 'high', 'medium', 'low']),
    description: z.string().trim().min(5).max(1000)
  }) }),
  sosQuery: z.object({ query: z.object({
    status: z.enum(['pending', 'accepted', 'en_route', 'reached', 'resolved', 'cancelled']).optional(),
    severity: z.enum(['High', 'Medium', 'Low']).optional()
  }) }),
  sosId: z.object({ params: z.object({ id }) }),
  status: z.object({ params: z.object({ id }), body: z.object({
    status: z.enum(['en_route', 'reached', 'resolved'])
  }) }),
  assignment: z.object({ params: z.object({ id }), body: z.object({
    rescuerId: id.nullable()
  }) }),
  userId: z.object({ params: z.object({ id }) }),
  duty: z.object({ body: z.object({ duty: z.enum(['on', 'off']) }) }),
  notificationId: z.object({ params: z.object({ id }) })
};

module.exports = { schemas, phone };
