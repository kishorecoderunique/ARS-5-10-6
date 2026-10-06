/**
 * ARS - Disaster Rescue & SOS Management System
 * Configuration file for Google Maps API Key and System Parameters
 *
 * INSTRUCTIONS:
 * Add a restricted Google Maps browser API key below in GOOGLE_MAPS_API_KEY.
 * Do not commit real keys to the repository.
 * If left empty or invalid, the rescuer map panel shows a setup message.
 * The admin dashboard uses its interactive fallback map in that case.
 */

window.ARS_CONFIG = {
  USE_MOCK: false,
  API_BASE: ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    ? 'http://localhost:5000/api'
    : '/api',

  GOOGLE_MAPS_API_KEY: 'AIzaSyCJGFFTUxsfI4t3rAjkIGB4yRXCT4tbqsI',

  // Default Map Center (Chennai, Tamil Nadu)
  DEFAULT_MAP_CENTER: {
    lat: 13.0400,
    lng: 80.2400
  },
  DEFAULT_ZOOM: 12
};
