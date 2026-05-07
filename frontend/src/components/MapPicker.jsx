import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export default function MapPicker({ lat, lng, onLocationSelect, readOnly = false, markers = [], height = '300px' }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  const [position, setPosition] = useState({ lat: lat || 19.076, lng: lng || 72.8777 });

  useEffect(() => {
    if (mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current).setView([position.lat, position.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapInstance.current);

    if (!readOnly) {
      // Draggable marker for picking
      const icon = L.divIcon({
        html: '<div style="font-size:28px;text-align:center">📍</div>',
        iconSize: [30, 30], iconAnchor: [15, 30], className: ''
      });
      markerRef.current = L.marker([position.lat, position.lng], { draggable: true, icon }).addTo(mapInstance.current);
      markerRef.current.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPosition({ lat, lng });
        if (onLocationSelect) onLocationSelect(lat, lng);
      });

      mapInstance.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        markerRef.current.setLatLng([lat, lng]);
        setPosition({ lat, lng });
        if (onLocationSelect) onLocationSelect(lat, lng);
      });
    }

    // Add extra markers
    markers.forEach(m => {
      const icon = L.divIcon({
        html: `<div style="font-size:20px;text-align:center">${m.icon || '📌'}</div>`,
        iconSize: [24, 24], iconAnchor: [12, 24], className: ''
      });
      L.marker([m.lat, m.lng], { icon })
        .addTo(mapInstance.current)
        .bindPopup(m.popup || '');
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setPosition({ lat: latitude, lng: longitude });
          if (mapInstance.current) mapInstance.current.setView([latitude, longitude], 15);
          if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
          if (onLocationSelect) onLocationSelect(latitude, longitude);
        },
        () => alert('Unable to get your location')
      );
    }
  };

  return (
    <div className="relative">
      <div ref={mapRef} style={{ height, width: '100%' }} className="rounded-xl border border-white/10" />
      {!readOnly && (
        <button type="button" onClick={getCurrentLocation}
          className="absolute top-3 right-3 z-[1000] bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg transition-colors flex items-center gap-1">
          📍 My Location
        </button>
      )}
      {!readOnly && (
        <p className="text-xs text-[#dfe3ff] mt-2">
          📍 {position.lat.toFixed(4)}, {position.lng.toFixed(4)} — Click map or drag pin to set location
        </p>
      )}
    </div>
  );
}
