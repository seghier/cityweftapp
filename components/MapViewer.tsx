
import React, { useEffect, useRef } from 'react';

declare const L: any;

interface MapViewerProps {
  onPolygonChange: (coords: [number, number][], area: number) => void;
  flyTo?: [number, number] | null;
  clearTrigger?: number;
}

const MapViewer: React.FC<MapViewerProps> = ({ onPolygonChange, flyTo, clearTrigger }) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onPolygonChangeRef = useRef(onPolygonChange);

  // Keep the ref up to date
  useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  useEffect(() => {
    if (mapRef.current && flyTo) {
      mapRef.current.flyTo(flyTo, 16, {
        duration: 2.5,
        easeLinearity: 0.1
      });
    }
  }, [flyTo]);

  // Handle programmatic clear
  useEffect(() => {
    if (mapRef.current && clearTrigger !== undefined) {
      mapRef.current.eachLayer((l: any) => {
        if (l.pm && (l instanceof L.Rectangle || l instanceof L.Polygon)) {
          mapRef.current.removeLayer(l);
        }
      });
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [27.0, 15.0], // North Africa
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
      maxBoundsViscosity: 1.0,
      preferCanvas: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      keepBuffer: 8
    }).addTo(map);

    map.pm.addControls({
      position: 'topright',
      drawCircle: false,
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawPolygon: false,
      drawRectangle: true,
      drawText: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
      editMode: true,
      dragMode: true
    });

    const calculateArea = (layer: any) => {
      try {
        const bounds = layer.getBounds();
        if (!bounds || bounds.getSouthWest().equals(bounds.getNorthEast())) return 0;

        const R = 6371; // Earth's radius in km
        const lat1 = bounds.getSouth() * Math.PI / 180;
        const lat2 = bounds.getNorth() * Math.PI / 180;
        const lon1 = bounds.getWest() * Math.PI / 180;
        const lon2 = bounds.getEast() * Math.PI / 180;

        const area = Math.abs(R * R * (Math.sin(lat2) - Math.sin(lat1)) * (lon2 - lon1));
        return area;
      } catch (err) {
        return 0;
      }
    };

    const getCoords = (layer: any) => {
      try {
        const latlngs = layer.getLatLngs() as any[][];
        if (!latlngs || !latlngs[0]) return [];
        const coords: [number, number][] = latlngs[0].map((p: any) => [p.lat, p.lng]);
        coords.push(coords[0]);
        return coords;
      } catch (err) {
        return [];
      }
    };

    // Real-time calculation during drawing
    map.on('pm:drawstart', (e: any) => {
      const workingLayer = e.workingLayer;
      if (workingLayer) {
        workingLayer.on('pm:change', () => {
          const area = calculateArea(workingLayer);
          onPolygonChangeRef.current([], area);
        });
      }
    });

    map.on('pm:create', (e: any) => {
      const layer = e.layer;

      // Clear others
      map.eachLayer((l: any) => {
        if (l.pm && l !== layer && (l instanceof L.Rectangle || l instanceof L.Polygon)) {
          map.removeLayer(l);
        }
      });

      layer.setStyle({
        color: '#3b82f6',
        weight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        dashArray: '10, 10'
      });

      const updateInfo = () => {
        const area = calculateArea(layer);
        const coords = getCoords(layer);
        onPolygonChangeRef.current(coords, area);
      };

      updateInfo();
      layer.on('pm:edit', updateInfo);
      layer.on('pm:dragend', updateInfo);
      layer.on('pm:remove', () => onPolygonChangeRef.current([], 0));
    });

    map.on('pm:remove', () => onPolygonChangeRef.current([], 0));

    mapRef.current = map;
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures initialization only happens once

  return (
    <div ref={containerRef} className="fixed inset-0 w-full h-full z-0 cursor-crosshair bg-slate-950" />
  );
};

export default MapViewer;
