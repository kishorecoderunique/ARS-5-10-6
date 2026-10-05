async function sendSms(config, phone, message) {
  if (config.smsProvider === 'console') {
    console.log(`[SMS to ${phone}] ${message}`);
    return;
  }

  if (config.smsProvider === 'twilio') {
    const [accountSid, authToken] = config.smsApiKey.split(':');
    if (!accountSid || !authToken || !config.smsFrom) throw new Error('Twilio requires SMS_API_KEY=accountSid:authToken and SMS_FROM.');
    const body = new URLSearchParams({ To: `+91${phone}`, From: config.smsFrom, Body: message });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const code = result.code ? ` (code ${result.code})` : '';
      const details = result.message
        ? `: ${result.message.replace(/\+\d{7,15}/g, '[phone number]')}`
        : '';
      throw new Error(`Twilio SMS request failed with status ${response.status}${code}${details}.`);
    }
    return;
  }

  if (config.smsProvider === 'msg91') {
    const response = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: config.smsApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: config.smsFrom,
        recipients: [{ mobiles: `91${phone}`, VAR1: message }]
      })
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(`MSG91 SMS request failed with status ${response.status}${result.message ? `: ${result.message}` : ''}.`);
    }
    return;
  }

  throw new Error(`Unsupported SMS_PROVIDER "${config.smsProvider}".`);
}

module.exports = { sendSms };
