const addressCache = new Map();
let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();

function cacheKey(lat, lng) {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
}

async function fetchGoogleAddress(config, lat, lng) {
  if (!config.geocodingKey) return null;

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', config.geocodingKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Google reverse geocoding failed with status ${response.status}.`);
  const data = await response.json();
  if (data.status !== 'OK' || !data.results?.[0]?.formatted_address) return null;
  return { address: data.results[0].formatted_address, provider: 'google' };
}

async function fetchNominatimAddress(lat, lng) {
  const run = nominatimQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    lastNominatimRequestAt = Date.now();
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ARS-Rescue-System/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`OpenStreetMap reverse geocoding failed with status ${response.status}.`);
    const data = await response.json();
    return data.display_name
      ? { address: data.display_name, provider: 'openstreetmap' }
      : null;
  });
  nominatimQueue = run.catch(() => {});
  return run;
}

async function reverseGeocodeAddress(config, lat, lng) {
  const key = cacheKey(lat, lng);
  const cached = addressCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let result = null;
  if (config.geocodingKey) {
    try {
      result = await fetchGoogleAddress(config, lat, lng);
    } catch (error) {
      console.error('Google reverse geocoding failed:', error.message);
    }
  }
  if (!result) {
    try {
      result = await fetchNominatimAddress(lat, lng);
    } catch (error) {
      console.error('OpenStreetMap reverse geocoding failed:', error.message);
    }
  }

  if (result) addressCache.set(key, { result, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  return result;
}

async function reverseGeocode(config, lat, lng) {
  const result = await reverseGeocodeAddress(config, lat, lng);
  return result?.address || 'Unknown location';
}

module.exports = { reverseGeocode, reverseGeocodeAddress };
