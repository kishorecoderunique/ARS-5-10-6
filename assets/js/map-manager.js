/**
 * ARS - Disaster Rescue & SOS Management System
 * Dual Map Engine Manager (/assets/js/map-manager.js)
 * Rescue Radar Engine
 */

window.ARS_MapManager = (function () {
  let googleMap = null;
  let directionsRequestId = 0;
  let directionsPolylines = [];
  let directionsMarkers = [];
  let mapContainerId = null;
  let activeMarkers = [];
  let polylineLines = [];
  let isGoogleMapsLoaded = false;
  let fallbackCanvas = null;
  let onMarkerClickCallback = null;
  let mode = 'rescuer';
  let mapUnavailable = false;
  let highlightedSosId = null;
  let highlightedRadarRadius = 0;
  let locationLookupId = 0;

  const darkNavyMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#070D1A" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#8B9BB4" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#070D1A" }] },
    { "featureClass": "administrative", "elementType": "geometry", "stylers": [{ "color": "#1C2B47" }] },
    { "featureType": "administrative.country", "elementType": "labels.text.fill", "stylers": [{ "color": "#A0B3D0" }] },
    { "featureType": "landscape.man_made", "elementType": "geometry", "stylers": [{ "color": "#0F1A2E" }] },
    { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#0A1426" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#122038" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#64748B" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1C2B47" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#526585" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#263D64" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#0F1A2E" }] },
    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#16253F" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#040812" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#475569" }] }
  ];

  function initMap(containerId, options = {}) {
    mapContainerId = containerId;
    mode = options.mode || 'rescuer';
    onMarkerClickCallback = options.onMarkerClick || null;
    mapUnavailable = false;

    const apiKey = (window.ARS_CONFIG && window.ARS_CONFIG.GOOGLE_MAPS_API_KEY) ? window.ARS_CONFIG.GOOGLE_MAPS_API_KEY.trim() : '';

    if (apiKey && apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      loadGoogleMapsScript(apiKey);
    } else {
      console.warn("Google Maps API key is missing or placeholder.");
      renderMapFailure();
    }
  }

  function renderMapFailure() {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    mapUnavailable = true;
    googleMap = null;
    activeMarkers = [];
    clearDirections();
    fallbackCanvas = null;
    if (mode === 'rescuer') {
      container.innerHTML = '<div class="map-unavailable-message" role="status">Map unavailable. Add your Google Maps API key in config.js.</div>';
      return;
    }

    renderFallbackMap();
  }

  function loadGoogleMapsScript(apiKey) {
    if (window.google && window.google.maps) {
      renderGoogleMap();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=window.ARS_MapManager_onGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error("Failed to load Google Maps script.");
      renderMapFailure();
    };
    window.ARS_MapManager_onGoogleMapsLoaded = function () {
      if (mapUnavailable) return;
      isGoogleMapsLoaded = true;
      renderGoogleMap();
    };
    window.gm_authFailure = function () {
      console.error("Google Maps rejected the configured API key.");
      renderMapFailure();
    };
    document.head.appendChild(script);
  }

  function renderGoogleMap() {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    const center = window.ARS_CONFIG.DEFAULT_MAP_CENTER;
    googleMap = new google.maps.Map(container, {
      center: center,
      zoom: window.ARS_CONFIG.DEFAULT_ZOOM || 12,
      styles: darkNavyMapStyle,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    updateMarkers();
  }

  // Fallback Canvas Map
  function renderFallbackMap() {
    const container = document.getElementById(mapContainerId);
    if (!container) return;

    container.innerHTML = `
      <div class="fallback-map-container" id="${mapContainerId}-fallback">
        <canvas id="${mapContainerId}-canvas"></canvas>
        <div style="position: absolute; bottom: 12px; left: 12px; background: rgba(15,26,46,0.88); backdrop-filter: blur(6px); border: 1px solid var(--grid-line); padding: 6px 12px; border-radius: 9999px; font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted); z-index: 10;">
          <span>⚡ Rescue Radar Interactive Grid (Chennai Region)</span>
        </div>
      </div>
    `;

    const canvas = document.getElementById(`${mapContainerId}-canvas`);
    fallbackCanvas = canvas;
    fitCanvasSize(canvas, container);

    window.addEventListener('resize', () => fitCanvasSize(canvas, container));

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const sosList = window.ARS_State ? window.ARS_State.getSortedSosList() : [];
      sosList.forEach(sos => {
        const pt = latLngToCanvas(sos.lat, sos.lng, canvas.width, canvas.height);
        const dist = Math.hypot(clickX - pt.x, clickY - pt.y);
        if (dist <= 18) {
          highlightedSosId = sos.id;
          if (onMarkerClickCallback) onMarkerClickCallback(sos);
          showFallbackPopup(sos, pt.x, pt.y, container);
        }
      });
    });

    startFallbackAnimationLoop();
  }

  function fitCanvasSize(canvas, container) {
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  function latLngToCanvas(lat, lng, width, height) {
    const minLat = 12.88;
    const maxLat = 13.12;
    const minLng = 80.08;
    const maxLng = 80.30;

    const x = ((lng - minLng) / (maxLng - minLng)) * (width * 0.8) + (width * 0.1);
    const y = height - (((lat - minLat) / (maxLat - minLat)) * (height * 0.8) + (height * 0.1));
    return { x, y };
  }

  let animationFrameId = null;
  let pulseTick = 0;

  function startFallbackAnimationLoop() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);

    function loop() {
      pulseTick += 0.03;
      drawFallbackCanvas();
      animationFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  function drawFallbackCanvas() {
    if (!fallbackCanvas) return;
    const ctx = fallbackCanvas.getContext('2d');
    const width = fallbackCanvas.width;
    const height = fallbackCanvas.height;

    ctx.fillStyle = '#070D1A';
    ctx.fillRect(0, 0, width, height);

    // Radar Grid Lines
    ctx.strokeStyle = '#1C2B47';
    ctx.lineWidth = 1;
    const gridSize = 45;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Bay of Bengal Coastline SVG path styling
    ctx.fillStyle = '#040812';
    ctx.beginPath();
    ctx.moveTo(width * 0.78, 0);
    ctx.bezierCurveTo(width * 0.74, height * 0.4, width * 0.76, height * 0.7, width * 0.82, height);
    ctx.lineTo(width, height);
    ctx.lineTo(width, 0);
    ctx.closePath();
    ctx.fill();

    const sosList = window.ARS_State ? window.ARS_State.getSortedSosList() : [];
    const rescuers = window.ARS_State ? window.ARS_State.getRescuers() : [];

    // Admin Connecting Lines
    if (mode === 'admin') {
      rescuers.forEach(r => {
        if (r.status === 'on_case' && r.assignedSosId) {
          const targetSos = sosList.find(s => s.id === r.assignedSosId);
          if (targetSos) {
            const rPt = latLngToCanvas(r.lat, r.lng, width, height);
            const sPt = latLngToCanvas(targetSos.lat, targetSos.lng, width, height);

            ctx.beginPath();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = '#E10600';
            ctx.lineWidth = 2;
            ctx.moveTo(rPt.x, rPt.y);
            ctx.lineTo(sPt.x, sPt.y);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      });
    }

    // Rescuer Pins (Safe Teal-Green for On Duty)
    if (mode === 'admin') {
      rescuers.forEach(r => {
        if (r.status !== 'off_duty' && r.status !== 'pending_approval' && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng))) {
          const pt = latLngToCanvas(r.lat, r.lng, width, height);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = r.status === 'on_case' ? '#E10600' : '#19D3A2';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    }

    // Draw SOS Pins with 3 Expanding Pulse Rings
    sosList.forEach(sos => {
      const pt = latLngToCanvas(sos.lat, sos.lng, width, height);
      const colors = { high: '#E10600', medium: '#FF8A00', low: '#FFD60A' };
      const color = colors[sos.severity] || '#E10600';
      const speedMultiplier = sos.severity === 'high' ? 1.5 : (sos.severity === 'medium' ? 1.0 : 0.6);

      // Faint Radar Ring for Selected SOS Pin
      if (sos.id === highlightedSosId) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 28, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(225, 6, 0, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3 Pulse Rings
      for (let i = 0; i < 3; i++) {
        const ringProgress = (pulseTick * speedMultiplier + i * 0.33) % 1;
        const radius = 8 + ringProgress * 24;
        const alpha = 1 - ringProgress;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(color, alpha * 0.7);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pin Core
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });
  }

  function showFallbackPopup(sos, x, y, container) {
    const escapeHtml = window.ARS_State.escapeHtml;
    let popup = document.getElementById('fallback-map-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'fallback-map-popup';
      popup.style.cssText = `
        position: absolute;
        z-index: 1000;
        background: #0F1A2E;
        border: 1.5px solid var(--grid-line);
        border-radius: 16px;
        padding: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.65);
        color: #F5F7FA;
        width: 260px;
        pointer-events: auto;
      `;
      container.appendChild(popup);
    }

    popup.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
        <span class="severity-badge severity-${sos.severity}">${sos.severity}</span>
        <button onclick="document.getElementById('fallback-map-popup').style.display='none'" style="color:#9CA3AF; font-size:16px;">✕</button>
      </div>
      <div style="font-family:var(--font-heading); font-weight:800; font-size:1.05rem; margin-bottom:4px;">${escapeHtml(sos.victimName)}</div>
      <div style="font-family:var(--font-mono); font-size:0.8rem; color:#9CA3AF; margin-bottom:8px;">${escapeHtml(sos.phone)}</div>
      <div id="fallback-victim-address"></div>
    `;

    popup.style.left = `${Math.min(x + 10, container.clientWidth - 280)}px`;
    popup.style.top = `${Math.min(y - 80, container.clientHeight - 180)}px`;
    popup.style.display = 'block';
    popup.dataset.sosId = sos.id;
    const lookupId = ++locationLookupId;
    renderVictimLocation(popup.querySelector('#fallback-victim-address'), sos, '📍 Getting victim address...');
    lookupVictimAddress(sos).then(result => {
      if (lookupId !== locationLookupId || popup.dataset.sosId !== sos.id || !popup.isConnected) return;
      renderVictimLocation(popup.querySelector('#fallback-victim-address'), {
        ...sos,
        lat: result?.lat ?? sos.lat,
        lng: result?.lng ?? sos.lng
      }, result?.address || '⚠️ Address unavailable', result?.provider);
    });
  }

  function renderVictimLocation(container, sos, address, provider = null) {
    if (!container) return;
    const escapeHtml = window.ARS_State.escapeHtml;
    const lat = Number(sos.lat);
    const lng = Number(sos.lng);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
    container.innerHTML = `
      <div style="font-weight:800; margin:10px 0 6px;">🚨 VICTIM LOCATION</div>
      <div style="font-size:0.85rem; margin-bottom:4px;">📍 Full Address:</div>
      <div style="font-size:0.84rem; color:#E2E8F0; overflow-wrap:anywhere;">${escapeHtml(address)}</div>
      ${provider === 'openstreetmap' ? '<div style="font-size:0.68rem; color:#94A3B8; margin-top:3px;">© OpenStreetMap contributors</div>' : ''}
      <div style="font-size:0.82rem; margin-top:8px;">🌐 Coordinates:</div>
      <div style="font-family:var(--font-mono); font-size:0.75rem; color:#CBD5E1;">Latitude: ${escapeHtml(String(sos.lat))}<br>Longitude: ${escapeHtml(String(sos.lng))}</div>
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:10px; padding:7px 10px; border-radius:8px; background:#E10600; color:#fff; text-decoration:none; font-size:0.75rem; font-weight:700;">OPEN IN MAPS</a>
    `;
  }

  async function lookupVictimAddress(sos) {
    try {
      return await window.ARS_API.request(`/sos/${encodeURIComponent(sos.id)}/location`);
    } catch (error) {
      console.error('Victim address lookup failed:', error.message);
      return null;
    }
  }

  function updateMarkers() {
    if (googleMap) {
      clearGoogleMapMarkers();

      const sosList = window.ARS_State ? window.ARS_State.getSortedSosList() : [];
      const rescuers = window.ARS_State ? window.ARS_State.getRescuers() : [];

      sosList.forEach(sos => {
        const markerColor = sos.severity === 'high' ? '#E10600' : (sos.severity === 'medium' ? '#FF8A00' : '#FFD60A');
        const escapeHtml = window.ARS_State.escapeHtml;

        const marker = new google.maps.Marker({
          position: { lat: sos.lat, lng: sos.lng },
          map: googleMap,
          title: `${sos.victimName} - ${sos.severity.toUpperCase()}`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2.5
          }
        });

        const infoWindow = new google.maps.InfoWindow();

        marker.addListener('click', () => {
          highlightedSosId = sos.id;
          const lookupId = ++locationLookupId;
          const content = document.createElement('div');
          renderVictimLocation(content, sos, '📍 Getting victim address...');
          infoWindow.setContent(`
            <div style="color:#0F1A2E; font-family:sans-serif; padding:6px; width:260px;">
              <div style="font-weight:800; font-size:1.05rem;">${escapeHtml(sos.victimName)}</div>
              <div style="font-family:monospace; color:#475569; font-size:0.85rem;">${escapeHtml(sos.phone)}</div>
              ${content.innerHTML}
            </div>
          `);
          infoWindow.open(googleMap, marker);
          lookupVictimAddress(sos).then(result => {
            if (lookupId !== locationLookupId) return;
            const addressContent = document.createElement('div');
            renderVictimLocation(addressContent, {
              ...sos,
              lat: result?.lat ?? sos.lat,
              lng: result?.lng ?? sos.lng
            }, result?.address || '⚠️ Address unavailable', result?.provider);
            infoWindow.setContent(`
              <div style="color:#0F1A2E; font-family:sans-serif; padding:6px; width:260px;">
                <div style="font-weight:800; font-size:1.05rem;">${escapeHtml(sos.victimName)}</div>
                <div style="font-family:monospace; color:#475569; font-size:0.85rem;">${escapeHtml(sos.phone)}</div>
                ${addressContent.innerHTML}
              </div>
            `);
          });
          if (onMarkerClickCallback) onMarkerClickCallback(sos);
        });

        activeMarkers.push({ id: sos.id, marker });
      });

      if (mode === 'admin') {
        rescuers.forEach(r => {
          if (r.status !== 'off_duty' && r.status !== 'pending_approval') {
            const rMarker = new google.maps.Marker({
              position: { lat: r.lat, lng: r.lng },
              map: googleMap,
              title: `Rescuer: ${r.name}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 7,
                fillColor: r.status === 'on_case' ? '#E10600' : '#19D3A2',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2
              }
            });
            activeMarkers.push({ id: r.id, marker: rMarker });

            if (r.status === 'on_case' && r.assignedSosId) {
              const sos = sosList.find(s => s.id === r.assignedSosId);
              if (sos) {
                const line = new google.maps.Polyline({
                  path: [{ lat: r.lat, lng: r.lng }, { lat: sos.lat, lng: sos.lng }],
                  geodesic: true,
                  strokeColor: '#E10600',
                  strokeOpacity: 0.8,
                  strokeWeight: 3.5,
                  map: googleMap
                });
                polylineLines.push(line);
              }
            }
          }
        });
      }
    }
  }

  function clearGoogleMapMarkers() {
    activeMarkers.forEach(item => item.marker.setMap(null));
    activeMarkers = [];
    polylineLines.forEach(line => line.setMap(null));
    polylineLines = [];
  }

  function highlightAndZoomToSos(sosId) {
    highlightedSosId = sosId;
    const sosList = window.ARS_State ? window.ARS_State.getSortedSosList() : [];
    const sos = sosList.find(s => s.id === sosId);
    if (!sos) return;

    if (googleMap) {
      googleMap.setCenter({ lat: sos.lat, lng: sos.lng });
      googleMap.setZoom(15);
      const found = activeMarkers.find(m => m.id === sosId);
      if (found) {
        found.marker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => found.marker.setAnimation(null), 1800);
      }
    } else if (fallbackCanvas) {
      const container = document.getElementById(mapContainerId);
      if (container) {
        const pt = latLngToCanvas(sos.lat, sos.lng, fallbackCanvas.width, fallbackCanvas.height);
        showFallbackPopup(sos, pt.x, pt.y, container);
      }
    }
  }

  async function showDirectionsToSos(sosId) {
    const sosList = window.ARS_State ? window.ARS_State.getSortedSosList() : [];
    const sos = sosList.find(item => item.id === sosId);
    if (!sos) {
      console.error(`Cannot show directions: SOS ${sosId} was not found.`);
      return;
    }

    if (!googleMap || !window.google || !window.google.maps) {
      showDirectionsPanelMessage('Directions are unavailable until Google Maps is loaded.');
      return;
    }

    const destination = { lat: Number(sos.lat), lng: Number(sos.lng) };
    const requestId = ++directionsRequestId;

    showDirectionsPanelMessage('Getting your current location and finding the fastest driving route...');
    clearDirections();
    try {
      const currentUser = window.ARS_State.getCurrentUser();
      const rescuer = window.ARS_State.getRescuers().find(item => currentUser && item.id === currentUser.id);
      const { origin, source } = await getRouteOrigin(rescuer);
      if (requestId !== directionsRequestId) return;

      const { Route } = await google.maps.importLibrary('routes');
      const { routes } = await Route.computeRoutes({
        origin,
        destination,
        travelMode: 'DRIVING',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        computeAlternativeRoutes: true,
        fields: ['path', 'viewport', 'legs', 'distanceMeters', 'durationMillis', 'staticDurationMillis']
      });
      if (requestId !== directionsRequestId) return;
      if (!routes || routes.length === 0) {
        showDirectionsPanelMessage('No driving route was found for this destination.', sos, origin);
        return;
      }

      const route = [...routes].sort((a, b) =>
        (a.durationMillis ?? a.legs?.[0]?.durationMillis ?? Number.MAX_SAFE_INTEGER) -
        (b.durationMillis ?? b.legs?.[0]?.durationMillis ?? Number.MAX_SAFE_INTEGER)
      )[0];
      directionsPolylines = route.createPolylines();
      directionsPolylines.forEach(polyline => {
        polyline.setOptions({
          strokeColor: '#19D3A2',
          strokeOpacity: 0.9,
          strokeWeight: 6
        });
        polyline.setMap(googleMap);
      });
      if (route.viewport) googleMap.fitBounds(route.viewport);

      directionsMarkers.push(new google.maps.Marker({
        position: origin,
        map: googleMap,
        title: 'Rescuer starting point',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#19D3A2',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        }
      }));
      renderDirectionsPanel(sos, route.legs && route.legs[0], origin, source);
    } catch (error) {
      if (requestId !== directionsRequestId) return;
      console.error('Could not calculate the fastest route to the SOS.', error);
      showDirectionsPanelMessage(error.message || 'Could not calculate a route. Open navigation in Google Maps instead.', sos);
    }
  }

  async function getRouteOrigin(rescuer) {
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
          });
        });
        return {
          origin: { lat: position.coords.latitude, lng: position.coords.longitude },
          source: 'current'
        };
      } catch (error) {
        const hasSavedLocation = hasValidRescuerLocation(rescuer);
        if (hasSavedLocation) {
          return {
            origin: { lat: Number(rescuer.lat), lng: Number(rescuer.lng) },
            source: 'saved'
          };
        }
        if (error.code === error.PERMISSION_DENIED) {
          throw new Error('Location permission is required to calculate your route. Allow location access, or open Google Maps navigation below.');
        }
        throw new Error('Your current location is unavailable. Open Google Maps navigation below to route from your device.');
      }
    }

    if (hasValidRescuerLocation(rescuer)) {
      return {
        origin: { lat: Number(rescuer.lat), lng: Number(rescuer.lng) },
        source: 'saved'
      };
    }
    throw new Error('This browser cannot provide your location. Open Google Maps navigation below to route from your device.');
  }

  function hasValidRescuerLocation(rescuer) {
    if (!rescuer || rescuer.lat == null || rescuer.lng == null) return false;
    const lat = Number(rescuer.lat);
    const lng = Number(rescuer.lng);
    return Number.isFinite(lat) && lat >= -90 && lat <= 90
      && Number.isFinite(lng) && lng >= -180 && lng <= 180;
  }

  function createGoogleMapsDirectionsUrl(sos, origin = null) {
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    if (origin) {
      url.searchParams.set('origin', `${Number(origin.lat)},${Number(origin.lng)}`);
    }
    url.searchParams.set('destination', `${Number(sos.lat)},${Number(sos.lng)}`);
    url.searchParams.set('travelmode', 'driving');
    url.searchParams.set('dir_action', 'navigate');
    return url.toString();
  }

  function appendGoogleMapsDirectionsLink(panel, sos, origin = null) {
    if (!panel || !sos) return;
    const link = document.createElement('a');
    link.href = createGoogleMapsDirectionsUrl(sos, origin);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'map-directions-navigation';
    link.textContent = 'Open directions in Google Maps';
    panel.appendChild(link);
  }

  function clearDirections() {
    directionsPolylines.forEach(polyline => polyline.setMap(null));
    directionsPolylines = [];
    directionsMarkers.forEach(marker => marker.setMap(null));
    directionsMarkers = [];
  }

  function getDirectionsPanel() {
    const container = document.getElementById(mapContainerId);
    if (!container) return null;

    let panel = container.querySelector('.map-directions-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'map-directions-panel';
      panel.setAttribute('aria-live', 'polite');
      panel.setAttribute('aria-label', 'Route directions');
      container.appendChild(panel);
    }
    return panel;
  }

  function showDirectionsPanelMessage(message, sos = null, origin = null) {
    const panel = getDirectionsPanel();
    if (!panel) return;
    panel.replaceChildren();
    const text = document.createElement('p');
    text.className = 'map-directions-message';
    text.textContent = message;
    panel.appendChild(text);
    appendGoogleMapsDirectionsLink(panel, sos, origin);
  }

  function renderDirectionsPanel(sos, leg, origin, source) {
    const panel = getDirectionsPanel();
    if (!panel) return;
    if (!leg) {
      showDirectionsPanelMessage('The route was found, but step-by-step directions are unavailable.', sos, origin);
      return;
    }

    panel.replaceChildren();
    const header = document.createElement('div');
    header.className = 'map-directions-header';
    const destination = document.createElement('div');
    destination.className = 'map-directions-destination';
    const destinationName = sos.locationName && sos.locationName !== 'Current GPS location'
      ? sos.locationName
      : sos.victimName;
    destination.textContent = `Route to ${destinationName}`;
    const summary = document.createElement('div');
    summary.className = 'map-directions-summary';
    const distance = leg.distanceMeters >= 1000
      ? `${(leg.distanceMeters / 1000).toFixed(1)} km`
      : `${leg.distanceMeters} m`;
    const duration = `${Math.ceil(leg.durationMillis / 60000)} min`;
    summary.textContent = `Fastest driving route · ${distance} · ${duration} · traffic-aware`;
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'map-directions-close';
    closeButton.setAttribute('aria-label', 'Close directions');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => {
      directionsRequestId += 1;
      clearDirections();
      panel.remove();
    });
    header.append(destination, closeButton);
    const originNote = document.createElement('p');
    originNote.className = 'map-directions-origin';
    originNote.textContent = source === 'current'
      ? 'Route starts from your current GPS location.'
      : 'Route starts from your last saved rescuer location.';
    panel.append(header, summary, originNote);

    const steps = document.createElement('ol');
    steps.className = 'map-directions-steps';
    (leg.steps || []).forEach(step => {
      const item = document.createElement('li');
      item.textContent = step.instructions || 'Continue along the highlighted route.';
      steps.appendChild(item);
    });
    panel.appendChild(steps);
    appendGoogleMapsDirectionsLink(panel, sos, origin);
  }

  function hexToRgba(hex, alpha) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
    }
    return `rgba(225,6,0,${alpha})`;
  }

  return {
    initMap,
    updateMarkers,
    highlightAndZoomToSos,
    showDirectionsToSos
  };
})();
