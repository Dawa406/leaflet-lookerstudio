const dscc = require('dscc');

const drawViz = (data) => {
  const container = document.getElementById('container');
  container.innerHTML = "";
  const map = L.map(container).setView([27.5, 90.5], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
  }).addTo(map);

  const rows = data.tables.DEFAULT;
  rows.forEach(row => {
    const geojsonStr = row.geojson;
    try {
      const geojson = JSON.parse(geojsonStr);
      L.geoJSON(geojson, {
        onEachFeature: (feature, layer) => {
          const label = row.Name || feature.properties?.Name || "Unnamed";
          layer.bindPopup(label);
        }
      }).addTo(map);
    } catch (e) {
      console.error('Invalid GeoJSON', e);
    }
  });
};

dscc.subscribeToData(drawViz, {transform: dscc.tableTransform});
