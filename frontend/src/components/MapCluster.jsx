import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapCluster({ items = [], height = '400px', center = [19.076, 72.8777], zoom = 12 }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance.current);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers (except tile layer)
    mapInstance.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapInstance.current.removeLayer(layer);
      }
    });

    items.forEach(item => {
      if (!item.latitude || !item.longitude) return;

      const color = item.status === 'completed' ? '#22c55e' :
        item.status === 'in_progress' ? '#f97316' :
          item.status === 'assigned' ? '#3b82f6' : '#ef4444';

      const icon = L.divIcon({
        html: `<div style="background-color:${color};width:16px;height:16px;border-radius:50%;border:3px solid rgba(255,255,255,0.3);box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: ''
      });

      L.marker([item.latitude, item.longitude], { icon })
        .addTo(mapInstance.current)
        .bindPopup(`
          <div style="font-family:sans-serif;padding:5px">
            <h4 style="margin:0 0 5px;font-weight:bold">${item.category?.replace('_', ' ').toUpperCase() || 'ISSUE'}</h4>
            <p style="margin:0;font-size:12px;color:#666">${item.description?.substring(0, 50)}...</p>
            <p style="margin:5px 0 0;font-size:11px;font-weight:bold;color:${color}">Status: ${item.status}</p>
          </div>
        `);
    });
  }, [items]);

  return (
    <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden" />
  );
}
