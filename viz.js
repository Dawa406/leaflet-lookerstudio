// viz.js
// Leaflet polygon renderer for Looker Studio community visualizations
// Expects a GeoJSON text column named "geojson" and a label column named "Name".
// Uses @google/dscc library if available, otherwise attempts to read Data Studio payload.

(function () {
  function loadScript(src, cb) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function () { console.error('Failed to load', src); cb && cb(); };
    document.head.appendChild(s);
  }

  function loadCSS(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

  function ensureContainer() {
    let root = document.getElementById('leaflet-viz-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'leaflet-viz-root';
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.minHeight = '300px';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.appendChild(root);
    }
    return root;
  }

  let map, geojsonLayer;

  function createMap() {
    const root = ensureContainer();
    if (map) {
      try { map.remove(); } catch (e) {}
    }
    root.innerHTML = '';
    const mapDiv = document.createElement('div');
    mapDiv.id = 'mapid';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '100%';
    root.appendChild(mapDiv);

    map = L.map('mapid', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    geojsonLayer = L.geoJSON(null, {
      onEachFeature: function (feature, layer) {
        let popup = '';
        if (feature.properties) {
          if (feature.properties.Name) popup += '<strong>' + feature.properties.Name + '</strong><br/>';
          const keys = Object.keys(feature.properties).filter(k => k !== 'Name');
          if (keys.length) {
            popup += '<small>';
            keys.forEach(k => popup += '<b>' + k + ':</b> ' + feature.properties[k] + '<br/>');
            popup += '</small>';
          }
        }
        if (popup) layer.bindPopup(popup);
      },
      style: function () {
        return { color: '#2b7cff', weight: 2, fillOpacity: 0.4 };
      }
    }).addTo(map);
  }

  function fitToLayer() {
    try {
      if (!geojsonLayer || !geojsonLayer.getLayers().length) return;
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    } catch (e) {}
  }

  function parseDSData(dsData) {
    const rows = [];
    let geojsonIndex = -1;
    let nameIndex = -1;

    function tryFromTable(table) {
      if (!table || !table.cols) return false;
      const cols = table.cols;
      for (let i = 0; i < cols.length; i++) {
        const id = (cols[i].label || cols[i].id || cols[i].name || '').toLowerCase();
        if (id === 'geojson') geojsonIndex = i;
        if (id === 'name') nameIndex = i;
      }
      if (!table.rows) return false;
      table.rows.forEach(r => rows.push(r.c ? r.c.map(c => c && c.v) : r));
      return true;
    }

    if (dsData && dsData.tables && dsData.tables.DEFAULT) tryFromTable(dsData.tables.DEFAULT);
    else if (dsData && dsData.cols && dsData.rows) tryFromTable(dsData);

    return { rows, geojsonIndex, nameIndex };
  }

  function renderFromData(dsData) {
    createMap();

    const parsed = parseDSData(dsData);
    const rows = parsed.rows;
    const gIdx = parsed.geojsonIndex;
    const nIdx = parsed.nameIndex;
    let featuresAdded = 0;

    rows.forEach(r => {
      const g = (r && r[gIdx]) ? r[gIdx] : null;
      const name = (r && r[nIdx]) ? r[nIdx] : null;
      if (!g) return;
      try {
        const gj = (typeof g === 'string') ? JSON.parse(g) : g;
        if (Array.isArray(gj.features)) {
          gj.features.forEach(f => {
            if (!f.properties) f.properties = {};
            if (name && !f.properties.Name) f.properties.Name = name;
            geojsonLayer.addData(f);
            featuresAdded++;
          });
        } else {
          if (!gj.properties) gj.properties = {};
          if (name && !gj.properties.Name) gj.properties.Name = name;
          geojsonLayer.addData(gj);
          featuresAdded++;
        }
      } catch (e) { console.warn('Could not parse geojson', e); }
    });

    if (featuresAdded === 0) {
      ensureContainer().innerHTML = '<div style="padding:16px;font-family:Arial;">No polygon features found. Ensure field named <b>geojson</b>.</div>';
      return;
    }
    fitToLayer();
  }

  window.drawLeafletVisualization = function (data) {
    try { renderFromData(data); } catch (e) { console.error(e); }
  };

  loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', function () {
    if (window.dscc && window.dscc.subscribeToData) {
      window.dscc.subscribeToData(renderFromData);
    } else {
      createMap();
      const root = ensureContainer();
      root.innerHTML = '<div style="padding:10px;font-family:Arial;">Leaflet visual ready. Waiting for data from Looker Studio.</div>';
    }
  });
})();
