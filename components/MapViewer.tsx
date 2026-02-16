
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
    const isInternalUpdate = useRef(false);

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
        if (isInternalUpdate.current) {
            isInternalUpdate.current = false;
            return;
        }

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
                isInternalUpdate.current = true;
                const area = calculateArea(polygonLayer);
                const coords = getCoords(polygonLayer);
                onPolygonChangeRef.current(coords, area);
            };

            // Wire up completion events so area updates only when the action is finished
            polygonLayer.on('pm:edit', updateInfo);
            polygonLayer.on('pm:dragend', updateInfo);
            polygonLayer.on('pm:remove', () => {
                isInternalUpdate.current = true;
                onPolygonChangeRef.current([], 0)
            });

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
            minZoom: 3,
            maxBounds: [[-85, -180], [85, 180]],
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
            dragMode: true,
            oneBlock: true
        });

        map.pm.setGlobalOptions({
            allowSelfIntersection: false,
            midPins: false,
            draggable: true,
            tooltips: false, // Disable tooltips
            snappable: true
        });

        // Unified Control Bar
        const UnifiedControls = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const container = L.DomUtil.create('div', 'leaflet-control unified-map-controls');

                // Prevent click propagation
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                // Helper to create a button
                const createBtn = (iconHtml: string, title: string, onClick: () => void, isActive: boolean = false) => {
                    const btn = L.DomUtil.create('div', 'unified-control-btn', container);
                    btn.innerHTML = iconHtml;
                    btn.title = title;
                    if (isActive) btn.classList.add('active');

                    L.DomEvent.on(btn, 'click', (e: any) => {
                        L.DomEvent.stop(e);
                        onClick();
                    });

                    return btn;
                };

                // Helper for Separator
                const createSeparator = () => {
                    L.DomUtil.create('div', 'control-separator', container);
                };

                // --- Group 1: Geoman Tools ---

                // Draw Rectangle
                const drawRectBtn = createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>',
                    'Draw Rectangle',
                    () => {
                        // Toggle Draw Rectangle
                        if (map.pm.globalDrawModeEnabled()) {
                            map.pm.disableDraw('Rectangle');
                        } else {
                            map.pm.enableDraw('Rectangle', {
                                snappable: true,
                                tooltips: false
                            });
                        }
                    }
                );

                // Edit Layers
                const editBtn = createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
                    'Edit Layers',
                    () => {
                        map.pm.toggleGlobalEditMode();
                    }
                );

                // Drag Layers
                const dragBtn = createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><circle cx="12" cy="12" r="3"></circle></svg>',
                    'Drag Layers',
                    () => {
                        map.pm.toggleGlobalDragMode();
                    }
                );

                // Delete Layers
                const deleteBtn = createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
                    'Remove Layers',
                    () => {
                        map.pm.toggleGlobalRemovalMode();
                    }
                );

                // Listen to map events to update active state of buttons
                const updateActiveStates = () => {
                    const drawEnabled = map.pm.globalDrawModeEnabled();
                    const editEnabled = map.pm.globalEditModeEnabled();
                    const dragEnabled = map.pm.globalDragModeEnabled();
                    const removalEnabled = map.pm.globalRemovalModeEnabled();

                    drawRectBtn.style.color = drawEnabled ? '#3b82f6' : 'inherit';
                    drawRectBtn.style.background = drawEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent';

                    editBtn.style.color = editEnabled ? '#3b82f6' : 'inherit';
                    editBtn.style.background = editEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent';

                    dragBtn.style.color = dragEnabled ? '#3b82f6' : 'inherit';
                    dragBtn.style.background = dragEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent';

                    deleteBtn.style.color = removalEnabled ? '#ef4444' : 'inherit';
                    deleteBtn.style.background = removalEnabled ? 'rgba(239, 68, 68, 0.2)' : 'transparent';
                };

                map.on('pm:globaldrawmodetoggled pm:globaleditmodetoggled pm:globaldragmodetoggled pm:globalremovalmodetoggled', updateActiveStates);


                createSeparator();

                // --- Group 2: Zoom Controls ---

                // Zoom In
                createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    'Zoom In',
                    () => map.zoomIn()
                );

                // Zoom Out
                createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
                    'Zoom Out',
                    () => map.zoomOut()
                );

                // Fit Bounds
                createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>',
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

                createSeparator();

                // --- Group 3: Style Toggle ---
                createBtn(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
                    'Toggle Map Style',
                    () => {
                        if (isSatellite) {
                            map.removeLayer(satelliteLayer);
                            map.addLayer(voyagerLayer);
                        } else {
                            map.removeLayer(voyagerLayer);
                            map.addLayer(satelliteLayer);
                        }
                        isSatellite = !isSatellite;
                    }
                );

                return container;
            }
        });

        // Add the Unified Control to the map
        map.addControl(new UnifiedControls());

        // We no longer hack the DOM moving buttons. We created our own.
        // But we DO need to ensure the default Geoman controls (if any) are hidden.
        // This is handled by CSS: .leaflet-pm-toolbar { display: none !important; }

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
                    // This is just real-time area update, arguably internal but doesn't affect externalPolygon unless we persist partials
                    // Usually we only persist on create.
                    const area = calculateArea(workingLayer);
                    // We don't push coords here usually, or if we do, we should mark internal
                    isInternalUpdate.current = true;
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
                isInternalUpdate.current = true;
                const area = calculateArea(layer);
                const coords = getCoords(layer);
                onPolygonChangeRef.current(coords, area);
            };

            updateInfo();
            layer.on('pm:edit', updateInfo);
            layer.on('pm:dragend', updateInfo);
            layer.on('pm:remove', () => {
                isInternalUpdate.current = true;
                onPolygonChangeRef.current([], 0)
            });
        });

        map.on('pm:remove', () => {
            isInternalUpdate.current = true;
            onPolygonChangeRef.current([], 0)
        });

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
                    bottom: 32px !important; /* Matches footer spacing */
                    left: 50% !important;
                    transform: translateX(-50%) !important;
                    top: auto !important;
                    right: auto !important;
                    display: flex !important;
                    flex-direction: row !important; /* Horizontal layout */
                    gap: 0 !important; /* No gap between controls, they are unified */
                    align-items: flex-end !important;
                    pointer-events: none !important;
                    z-index: 999 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 440px !important;
                }

                /* Unified Control Styling - Matches Search Bar */
                .unified-map-controls {
                    pointer-events: auto !important;
                    margin: 0 !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3) !important;
                    background-color: rgba(15, 23, 42, 0.7) !important; /* Glass effect */
                    border-radius: 32px !important; /* Matches search bar pill shape */
                    overflow: hidden !important;
                    clear: none !important;
                    backdrop-filter: blur(20px) saturate(180%) !important;
                    -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    padding: 0 16px !important;
                    height: 48px !important; /* Match search bar height */
                    width: 100% !important;
                }

                /* Vertical Separator */
                .control-separator {
                    width: 1px !important;
                height: 24px !important;
                background-color: rgba(255, 255, 255, 0.1) !important;
                margin: 0 4px !important;
                }

                .unified-control-btn,
                /* General Button Styling inside Unified Control */
                .unified-control-btn {
                    width: 40px !important;
                    height: 40px !important;
                    line-height: 40px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    border: none !important;
                    color: #e2e8f0 !important; /* slate-200 */
                    background-color: transparent !important;
                    transition: all 0.2s !important;
                    border-radius: 50% !important; /* Circles */
                    cursor: pointer !important;
                }

                .unified-control-btn:hover {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    color: #ffffff !important;
                }
                
                /* Icon Scale fix */
                .unified-control-btn svg {
                    transform: scale(0.9);
                }

                /* Active State for buttons (Draw/Edit/Drag/Delete) */
                .unified-control-btn.active {
                    background-color: rgba(59, 130, 246, 0.2) !important;
                    color: #3b82f6 !important;
                }

                /* Hide Original Geoman Toolbar Container if it still persists */
                .leaflet-pm-toolbar {
                    display: none !important;
                }
                
                /* Override Leaflet Bar Defaults */
                .leaflet-bar {
                    border: none !important;
                    box-shadow: none !important;
                }
                
                .leaflet-bar a {
                    border-radius: 0 !important;
                    border: none !important;
                }
                
                /* Icon Scale fix for cleaner look */
                .unified-control-btn svg {
                    width: 24px !important;
                    height: 24px !important;
                    opacity: 0.92;
                }
                .unified-control-btn:hover svg {
                    opacity: 1;
                }
                
                /* Unified Control Text Color */
                .unified-map-controls {
                    color: inherit !important;
                }

                /* Force Hide Geoman Tooltips */
                .leaflet-pm-tooltip {
                    display: none !important;
                }

                /* Force Hide Geoman Action Buttons (Finish, Cancel) */
                .leaflet-pm-actions-container {
                    display: none !important;
                }
                `}
            </style>
            <div ref={containerRef} className="fixed inset-0 w-full h-full z-0 cursor-crosshair bg-slate-950" />
        </>
    );
};

export default MapViewer;


