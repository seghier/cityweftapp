
import React, { useEffect, useRef } from 'react';

declare const L: any;

interface MapViewerProps {
    onPolygonChange: (coords: [number, number][], area: number) => void;
    flyTo?: [number, number] | null;
    clearTrigger?: number;
    externalPolygon?: [number, number][] | null;
    locationName?: string | null;
}

const MapViewer: React.FC<MapViewerProps> = ({ onPolygonChange, flyTo, clearTrigger, externalPolygon, locationName }) => {
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

    // Handle external polygon update (e.g. from file load)
    useEffect(() => {
        if (mapRef.current && externalPolygon && externalPolygon.length > 0) {
            // Clear existing layers
            mapRef.current.eachLayer((l: any) => {
                if (l.pm && (l instanceof L.Rectangle || l instanceof L.Polygon)) {
                    mapRef.current.removeLayer(l);
                }
            });

            // Create new rectangle from the loaded polygon bounds
            const latLngs = externalPolygon.map(p => [p[0], p[1]]);
            const bounds = L.latLngBounds(latLngs);

            const polygonLayer = L.rectangle(bounds, {
                color: '#3b82f6',
                weight: 3,
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                dashArray: '10, 10'
            }).addTo(mapRef.current);

            // Area + coords helpers (same logic as in the main init)
            const calculateArea = (layer: any) => {
                try {
                    const b = layer.getBounds();
                    if (!b || b.getSouthWest().equals(b.getNorthEast())) return 0;
                    const R = 6371;
                    const lat1 = b.getSouth() * Math.PI / 180;
                    const lat2 = b.getNorth() * Math.PI / 180;
                    const lon1 = b.getWest() * Math.PI / 180;
                    const lon2 = b.getEast() * Math.PI / 180;
                    return Math.abs(R * R * (Math.sin(lat2) - Math.sin(lat1)) * (lon2 - lon1));
                } catch { return 0; }
            };

            const getCoords = (layer: any) => {
                try {
                    const ll = layer.getLatLngs() as any[][];
                    if (!ll || !ll[0]) return [];
                    const coords: [number, number][] = ll[0].map((p: any) => [p.lat, p.lng]);
                    coords.push(coords[0]);
                    return coords;
                } catch { return []; }
            };

            const updateInfo = () => {
                const area = calculateArea(polygonLayer);
                const coords = getCoords(polygonLayer);
                onPolygonChangeRef.current(coords, area);
            };

            // Wire up completion events so area updates only when the action is finished
            polygonLayer.on('pm:edit', updateInfo);
            polygonLayer.on('pm:dragend', updateInfo);
            polygonLayer.on('pm:remove', () => onPolygonChangeRef.current([], 0));

            // Fit bounds to focus on the polygon
            mapRef.current.fitBounds(polygonLayer.getBounds(), {
                padding: [50, 50],
                duration: 1.5,
                animate: true
            });
        }
    }, [externalPolygon]);

    // Location Label removed as per user request
    useEffect(() => {
        if (!mapRef.current) return;
        // Clean up existing label
        mapRef.current.eachLayer((l: any) => {
            if (l.options && l.options.pane === 'markerPane' && l instanceof L.Marker && l.options.icon?.options?.className?.includes('location-label-marker')) {
                mapRef.current.removeLayer(l);
            }
        });
    }, [locationName, externalPolygon]);

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

        const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20,
            subdomains: 'abcd',
            keepBuffer: 8
        }).addTo(map);

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        });

        let isSatellite = false;

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

        map.pm.setGlobalOptions({
            allowSelfIntersection: false,
            midPins: false,
            draggable: true
        });

        // Custom Zoom Control
        const ZoomControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-zoom-control');
                container.style.display = 'flex';
                container.style.backgroundColor = 'white';
                container.style.borderRadius = '12px';
                container.style.border = '1px solid #ccc';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.overflow = 'hidden';
                container.style.marginTop = '0';
                container.style.flexDirection = 'column'; // Vertical layout
                container.style.width = '36px';
                container.style.height = 'auto';

                L.DomEvent.disableClickPropagation(container);

                const createButton = (icon: string, title: string, onClick: () => void) => {
                    const btn = L.DomUtil.create('a', '', container);
                    btn.innerHTML = icon;
                    btn.title = title;
                    btn.href = '#';
                    btn.style.width = '36px';
                    btn.style.height = '36px';
                    btn.style.display = 'flex';
                    btn.style.alignItems = 'center';
                    btn.style.justifyContent = 'center';
                    btn.style.color = '#444';
                    btn.style.cursor = 'pointer';
                    btn.style.backgroundColor = 'white';
                    btn.style.border = 'none';
                    btn.style.transition = 'all 0.2s';

                    // Override global leaflet-bar a+a border-left
                    btn.style.setProperty('border-left', 'none', 'important');

                    btn.addEventListener('mouseenter', () => {
                        btn.style.backgroundColor = '#f4f4f4';
                        btn.style.color = '#000';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.backgroundColor = 'white';
                        btn.style.color = '#444';
                    });

                    L.DomEvent.on(btn, 'click', (e: any) => {
                        L.DomEvent.stop(e);
                        onClick();
                    });

                    return btn;
                };

                createButton(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    'Zoom In',
                    () => map.zoomIn()
                );

                createButton(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    'Zoom Out',
                    () => map.zoomOut()
                );

                createButton(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>',
                    'Zoom to Fit',
                    () => {
                        let hasSelection = false;
                        map.eachLayer((layer: any) => {
                            if (layer.pm && (layer instanceof L.Rectangle || layer instanceof L.Polygon)) {
                                map.fitBounds(layer.getBounds(), {
                                    padding: [50, 50],
                                    duration: 1.0,
                                    animate: true
                                });
                                hasSelection = true;
                            }
                        });
                        if (!hasSelection) {
                            map.setView([27.0, 15.0], 4, { duration: 1.0, animate: true });
                        }
                    }
                );

                return container;
            }
        });

        // Custom Map Style Control
        const MapStyleControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-map-style-control');
                container.style.backgroundColor = 'white';
                container.style.borderRadius = '12px';
                container.style.border = '1px solid #ccc';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                container.style.marginTop = '10px'; // Spacing between controls
                container.style.cursor = 'pointer';

                L.DomEvent.disableClickPropagation(container);

                const btn = L.DomUtil.create('a', '', container);
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
                btn.title = 'Toggle Map Style';
                btn.href = '#';
                btn.style.width = '36px';
                btn.style.height = '36px';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.color = '#444';

                btn.addEventListener('mouseenter', () => {
                    btn.style.backgroundColor = '#f4f4f4';
                    btn.style.color = '#000';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.backgroundColor = 'white';
                    btn.style.color = '#444';
                });

                L.DomEvent.on(btn, 'click', (e: any) => {
                    L.DomEvent.stop(e);
                    if (isSatellite) {
                        map.removeLayer(satelliteLayer);
                        map.addLayer(voyagerLayer);
                    } else {
                        map.removeLayer(voyagerLayer);
                        map.addLayer(satelliteLayer);
                    }
                    isSatellite = !isSatellite;
                });

                return container;
            }
        });

        // Add controls to map
        map.addControl(new ZoomControl());
        map.addControl(new MapStyleControl());

        // JS layout hacks removed in favor of CSS below

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
        <>
            <style>
                {`
                /* Override Leaflet Top Right Corner Container Position */
                .leaflet-top.leaflet-right {
                    position: absolute !important;
                    top: 32px !important; /* Matches top-8 */
                    right: 16px !important; /* Adjusted closer to edge as requested */
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 16px !important;
                    align-items: center !important;
                    pointer-events: none !important;
                    z-index: 999 !important;
                    bottom: auto !important;
                    left: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                /* General Control Styling - Dark Glass Theme */
                .leaflet-top.leaflet-right .leaflet-control {
                    pointer-events: auto !important;
                    margin: 0 !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                    background-color: rgba(15, 23, 42, 0.7) !important; /* Match .glass-panel */
                    border-radius: 12px !important;
                    overflow: hidden !important;
                    clear: none !important;
                    backdrop-filter: blur(20px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                }

                /* Force PM Toolbar Vertical */
                .leaflet-pm-toolbar {
                    display: flex !important;
                    flex-direction: column !important;
                    width: 44px !important;
                    height: auto !important;
                }
                .leaflet-pm-toolbar .leaflet-buttons-control-button {
                    width: 44px !important; 
                    height: 44px !important;
                    line-height: 44px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-bottom: none !important;
                    border-right: none !important;
                    color: #e2e8f0 !important; /* slate-200 */
                    background-color: transparent !important;
                }
                /* Target the icon specifically to scale it down and invert color for dark mode */
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-edit,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-delete,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-drag,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-marker,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-polygon,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-polyline,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-circle,
                .leaflet-pm-toolbar .leaflet-buttons-control-button .leaflet-pm-icon-rectangle {
                     transform: scale(0.7) !important;
                     filter: invert(1) brightness(1.5) !important; /* Make icons white */
                }
                .leaflet-pm-toolbar .leaflet-buttons-control-button:hover {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    color: #ffffff !important;
                }
                .leaflet-pm-toolbar .leaflet-buttons-control-button:last-child {
                    border-bottom: none !important;
                }

                /* Custom Zoom Vertical */
                .custom-zoom-control {
                    display: flex !important;
                    flex-direction: column !important;
                    width: 44px !important;
                    height: auto !important;
                }
                .custom-zoom-control a {
                    width: 44px !important;
                    height: 44px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-bottom: none !important;
                    border-left: none !important;
                    color: #e2e8f0 !important; /* slate-200 */
                    transition: all 0.2s !important;
                    background-color: transparent !important;
                }
                .custom-zoom-control a:hover {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    color: #ffffff !important; 
                }
                .custom-zoom-control a:last-child {
                    border-bottom: none !important;
                }

                /* Map Style Control */
                .custom-map-style-control {
                    width: 44px !important;
                    height: 44px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border-radius: 12px !important;
                }
                .custom-map-style-control a {
                    width: 100% !important;
                    height: 100% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border: none !important;
                    color: #e2e8f0 !important; /* slate-200 */
                    background-color: transparent !important;
                }
                .custom-map-style-control a:hover {
                     background-color: rgba(255, 255, 255, 0.1) !important;
                     color: #ffffff !important;
                }

                /* Remove default leaflet bar styles that interfere */
                .leaflet-bar {
                    border: none !important;
                }
                .leaflet-bar a {
                    border-radius: 0 !important;
                }
                `}
            </style>
            <div ref={containerRef} className="fixed inset-0 w-full h-full z-0 cursor-crosshair bg-slate-950" />
        </>
    );
};

export default MapViewer;
