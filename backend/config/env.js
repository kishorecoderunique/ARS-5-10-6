const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];

function loadEnv() {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  let supabaseUrl;
  try {
    supabaseUrl = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL must be a valid URL.');
  }
  if (!['http:', 'https:'].includes(supabaseUrl.protocol)) {
    throw new Error('SUPABASE_URL must use HTTP or HTTPS.');
  }

  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number between 1 and 65535.');
  }

  let frontendUrl;
  try {
    frontendUrl = new URL(process.env.FRONTEND_URL || `http://localhost:${port}`).origin;
  } catch {
    throw new Error('FRONTEND_URL must be a valid URL.');
  }

  return {
    port,
    supabaseUrl: supabaseUrl.toString().replace(/\/$/, ''),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    smsProvider: process.env.SMS_PROVIDER || 'console',
    frontendUrl,
    geocodingKey: process.env.GOOGLE_GEOCODING_KEY || ''
  };
}

module.exports = { loadEnv };
