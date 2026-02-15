import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Navigation,
  MapPin,
  Loader2,
  X,
  Download,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  FolderOpen,
  ExternalLink
} from 'lucide-react';
import { AppSettings, ExportFormat, AppStatus, CityweftPayload } from './types';
import { requestCityweftData, downloadFile, fetchGeometryJson, GeometryResponse, reverseGeocode } from './services/api';
import { getDirectoryHandle, saveDirectoryHandle, verifyPermission, saveFileToDirectory, appendToCSV, loadFileFromDirectory, updateLogWithRender, LogEntry } from './services/storage';
import MapViewer from './components/MapViewer';
import ControlPanel from './components/ControlPanel';
import ModelPreview from './components/ModelPreview';

const ApiKeyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (val: string) => void;
  nanoBananaApiKey: string;
  setNanoBananaApiKey: (val: string) => void;
  downloadPathName: string;
  onSelectDownloadFolder: () => void;
}> = ({ isOpen, onClose, apiKey, setApiKey, nanoBananaApiKey, setNanoBananaApiKey, downloadPathName, onSelectDownloadFolder }) => {
  const [showKey, setShowKey] = useState(false);
  const [showNanoKey, setShowNanoKey] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className="glass-panel w-full max-w-md rounded-[40px] p-10 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              <Key className="w-6 h-6 text-blue-500" />
              Credentials & Paths
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Authentication & Storage</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Cityweft API Key */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Cityweft API Key</label>
            <div className="flex gap-2">
              <div className="relative group flex-grow">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="cw_live_..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-6 pr-14 py-5 text-sm font-mono text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-1"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <a
                href="https://app.cityweft.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 flex items-center justify-center bg-slate-900/50 border border-white/10 rounded-2xl text-slate-400 hover:text-blue-400 hover:border-blue-500/30 hover:bg-blue-500/10 transition-all"
                title="Get Cityweft API Key"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* NanoBanana API Key */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Gemini API Key (Optional)</label>
            <div className="flex gap-2">
              <div className="relative group flex-grow">
                <input
                  type={showNanoKey ? "text" : "password"}
                  value={nanoBananaApiKey}
                  onChange={(e) => setNanoBananaApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-900/50 border border-white/10 rounded-2xl pl-6 pr-14 py-5 text-sm font-mono text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                />
                <button
                  onClick={() => setShowNanoKey(!showNanoKey)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors p-1"
                >
                  {showNanoKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <a
                href="https://aistudio.google.com/u/2/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="w-16 flex items-center justify-center bg-slate-900/50 border border-white/10 rounded-2xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
                title="Get Gemini API Key"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Download Path */}
          <div className="space-y-3">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Local Storage</label>
            <div className="flex gap-3">
              <div className="flex-grow bg-slate-900/50 border border-white/10 rounded-2xl px-6 py-5 text-sm font-mono text-slate-300 truncate">
                {downloadPathName || "Not set. Using browser default."}
              </div>
              <button
                onClick={onSelectDownloadFolder}
                className="px-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-2xl flex items-center justify-center transition-colors"
                title="Select Download Folder"
              >
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 px-1">Select a folder to save files and logs automatically.</p>
          </div>


          <div className="p-5 rounded-3xl bg-blue-500/5 border border-blue-500/10">
            <div className="flex gap-4">
              <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
              <p className="text-[11px] font-medium leading-relaxed text-slate-400">
                Keys and paths are stored securely in your browser.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('cityweft_api_key') || '');
  const [nanoBananaApiKey, setNanoBananaApiKey] = useState<string>(localStorage.getItem('nanobanana_api_key') || '');
  const [downloadPathName, setDownloadPathName] = useState<string>(localStorage.getItem('cityweft_download_path_name') || '');
  const [downloadHandle, setDownloadHandle] = useState<any | null>(null);

  useEffect(() => {
    localStorage.setItem('cityweft_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('nanobanana_api_key', nanoBananaApiKey);
  }, [nanoBananaApiKey]);

  useEffect(() => {
    // Load handle from IndexedDB
    getDirectoryHandle().then((handle) => {
      if (handle) {
        setDownloadHandle(handle);
        // We verify permission later when needed
        console.log("Loaded directory handle.");
      }
    });
  }, []);

  const handleSelectDownloadFolder = async () => {
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker();
      await saveDirectoryHandle(handle);
      setDownloadHandle(handle);
      setDownloadPathName(handle.name);
      localStorage.setItem('cityweft_download_path_name', handle.name);
    } catch (e) {
      console.error("Failed to select folder:", e);
    }
  };

  const [showApiModal, setShowApiModal] = useState(false);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [selectedPolygon, setSelectedPolygon] = useState<[number, number][] | null>(null);
  const [areaKm2, setAreaKm2] = useState<number>(0);
  const [mapFlyTo, setMapFlyTo] = useState<[number, number] | null>(null);
  const [clearTrigger, setClearTrigger] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<GeometryResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewFileLink, setPreviewFileLink] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<{ shortName: string, fullName: string } | null>(null);
  const [lastPreviewedPolygon, setLastPreviewedPolygon] = useState<[number, number][] | null>(null);

  const [settings, setSettings] = useState<AppSettings>({
    geometry: ['buildings', 'surface', 'infrastructure'],
    crs: 'local',
    cropScene: true,
    disableSurfaceProjection: false,
    topographyModel: false,
    topographyReturnType: null,
    defaultRoofType: 'flat'
  });

  const calculateAreaFromPolygon = (polygon: [number, number][]) => {
    if (polygon.length < 3) return 0;
    // Simple spherical polygon area approximation (adequate for small city regions)
    // Or better, use the same logic as MapViewer if possible, but strict geodetic area is complex without a library.
    // Let's use a standard spherical earth approximation.
    const R = 6371; // Earth radius in km

    // Shoelace formula for spherical coordinates (simplification for small areas)
    // Convert to radians
    const rad = polygon.map(p => [p[0] * Math.PI / 180, p[1] * Math.PI / 180]);

    let area = 0;
    if (rad.length > 2) {
      for (let i = 0; i < rad.length; i++) {
        const j = (i + 1) % rad.length;
        const p1 = rad[i];
        const p2 = rad[j];
        area += (p2[1] - p1[1]) * (2 + Math.sin(p1[0]) + Math.sin(p2[0]));
      }
      area = Math.abs(area * R * R / 2.0);
    }

    // Actually, for a simple rectangular bounds selection which this app mostly does:
    // We can just get bounds and compute rect area? 
    // But user might load complex polygon?
    // Let's stick to the bounds method used in MapViewer for consistency if we assume rect, 
    // OR use a proper libraryless implementation. 
    // The implementation above is a spherical approximation.

    return area;
  };

  const [exportConfig, setExportConfig] = useState<{ format: ExportFormat; version: number | null; filename: string }>({
    format: 'skp',
    version: null,
    filename: ''
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Disable context menu
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&accept-language=en`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (e) {
        console.error("Suggestion fetch failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 50);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Reverse Geocoding when polygon is selected manually (and no search query exists)
  useEffect(() => {
    if (selectedPolygon && selectedPolygon.length > 0 && (!searchQuery || searchQuery.trim() === '')) {
      // Calculate centroid
      let latSum = 0;
      let lonSum = 0;
      selectedPolygon.forEach(p => {
        latSum += p[0];
        lonSum += p[1];
      });
      const centerLat = latSum / selectedPolygon.length;
      const centerLon = lonSum / selectedPolygon.length;

      reverseGeocode(centerLat, centerLon).then(info => {
        if (info) {
          setLocationInfo(info);
          const safeName = info.fullName.split(',')[0].trim().replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
          // We actually want to avail the full name for the file if possible, or at least city_country
          const safeFullName = info.fullName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
          setExportConfig(prev => ({ ...prev, filename: safeFullName }));
        }
      });
    } else if (!selectedPolygon) {
      setLocationInfo(null);
    }
  }, [selectedPolygon]);

  const handleSelectLocation = (lat: string, lon: string, displayName: string) => {
    setMapFlyTo([parseFloat(lat), parseFloat(lon)]);
    setSearchQuery(displayName);
    const shortName = displayName.split(',')[0];
    setLocationInfo({ shortName, fullName: displayName });

    setShowSuggestions(false);
    // Use full name for file export
    const safeFullName = displayName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
    setExportConfig(prev => ({ ...prev, filename: safeFullName }));

    // Attempt to load cached preview if handle and name exist
    if (downloadHandle) {
      // We will do this check when Preview is clicked because we need the polygon too?
      // Actually user said: "if we close the window and open it again where the same region is selected we can view the same file quickly"
      // Just selecting location doesn't mean polygon is ready.
      // We wait for user to click Preview.
    }
  };

  const handleClearSelection = () => {
    setClearTrigger(prev => prev + 1);
    setSelectedPolygon(null);
    setAreaKm2(0);
  };

  const handlePolygonChange = useCallback((coords: [number, number][], area: number) => {
    setSelectedPolygon(coords);
    setAreaKm2(area);
  }, []);

  /**
   * Preview the model before downloading
   */
  const handlePreview = async () => {
    if (!apiKey || !selectedPolygon) {
      if (!apiKey) {
        setErrorMessage("Cityweft API Key is required.");
        setShowApiModal(true);
      }
      return;
    }

    // Check if we already have the data for this polygon
    if (previewData && lastPreviewedPolygon && JSON.stringify(lastPreviewedPolygon) === JSON.stringify(selectedPolygon)) {
      setIsLoadingPreview(false);
      setShowPreview(true);
      return;
    }

    setIsLoadingPreview(true);
    setShowPreview(true);
    setPreviewData(null);
    setErrorMessage(null);

    // cacheFilename: Used for quick reloading. 
    // For unnamed regions, we use a fixed name so we can always check "the last unnamed preview".
    const cacheFilename = locationInfo?.fullName
      ? `${locationInfo.fullName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_')}_preview.json`
      : (searchQuery
        ? `${searchQuery.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_')}_preview.json`
        : 'unnamed_region_preview.json');

    // storageFilename: Used for permanent record and CSV logging.
    // For unnamed regions, we append a timestamp to ensure uniqueness and prevent overwriting.
    let storageFilename = cacheFilename;
    const isUnnamed = !locationInfo?.fullName && (!searchQuery || searchQuery.trim() === '');

    if (isUnnamed) {
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      storageFilename = `unnamed_region_${dateStr}.json`;
    }

    // Capture the filename for later use (rendering)
    setPreviewFileLink(storageFilename);

    setPreviewFileLink(storageFilename);

    // Base name for logging
    const safeName = locationInfo?.fullName
      ? locationInfo.fullName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_')
      : (searchQuery ? searchQuery.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_') : 'unnamed_region');

    try {
      let cachedDataToUse: GeometryResponse | null = null;
      let existingCacheIsValid = false;

      // 1. Check cache (Always check the generic/stable cacheFilename)
      if (downloadHandle) {
        const hasPerm = await verifyPermission(downloadHandle, false);
        if (hasPerm) {
          const cachedJson = await loadFileFromDirectory(downloadHandle, cacheFilename);
          if (cachedJson) {
            try {
              const cachedObj = JSON.parse(cachedJson);
              // Check if it's the new wrapped format { sourcePolygon, settings, data }
              if (cachedObj.sourcePolygon && cachedObj.data) {
                // deep check settings and polygon
                const settingsMatch = JSON.stringify(cachedObj.settings?.topographyModel) === JSON.stringify(settings.topographyModel) &&
                  JSON.stringify(cachedObj.settings?.geometry) === JSON.stringify(settings.geometry); // Should we check full geometry array? Maybe.

                // Actually, let's just check the critical rendering settings that change the output geometry
                // For now, strict check on settings object might be too fragile if we add UI state to settings.
                // Let's check relevant subsets: topographyModel, geometry array.
                // Simplified: compare cachedObj.settings to current settings.

                // We'll trust the stored polygon exact match + settings match
                if (
                  JSON.stringify(cachedObj.sourcePolygon) === JSON.stringify(selectedPolygon) &&
                  (!cachedObj.settings || (
                    cachedObj.settings.topographyModel === settings.topographyModel
                    // We can add more specific checks here if needed, e.g. defaultRoofType if it affects preview
                  ))
                ) {
                  console.log("Loaded preview from cache (Exact polygon & settings match)");
                  cachedDataToUse = cachedObj.data;
                  existingCacheIsValid = true;
                } else {
                  console.log("Cache ignored: Polygon or Settings changed");
                }
              } else {
                // Fallback for legacy format or just distance check?
                // Given user requirement "settings changed ... need to downloaded again", we should probably be stricter.
                // If legacy format doesn't have settings, we can't verify settings, so we should probably invalid it if we want to be safe.
                // OR we assume legacy didn't have topo?
                // Let's just use the distance check for legacy but maybe warn?
                // Actually, best to just re-fetch if we can't verify.
              }
            } catch (e) {
              console.warn("Failed to parse cached preview", e);
            }
          }
        }
      }

      if (existingCacheIsValid && cachedDataToUse) {
        setPreviewData(cachedDataToUse);
        setLastPreviewedPolygon(selectedPolygon);
        setIsLoadingPreview(false);
        return;
      }

      const payload = {
        polygon: selectedPolygon,
        settings: {
          ...settings,
          topographyReturnType: (settings.topographyModel ? 'elevationMap' : null) as 'elevationMap' | null
        }
      };

      const geometryData = await fetchGeometryJson(payload, apiKey);
      setPreviewData(geometryData);
      setLastPreviewedPolygon(selectedPolygon);

      // 2. Save cache and log
      if (downloadHandle) {
        try {
          const hasPerm = await verifyPermission(downloadHandle, true);
          if (hasPerm) {
            // Prepare Wrapped JSON with Source Polygon AND Settings
            const cachePayload = {
              sourcePolygon: selectedPolygon,
              settings: {
                topographyModel: settings.topographyModel,
                geometry: settings.geometry
              },
              data: geometryData,
              timestamp: Date.now()
            };
            const contentStr = JSON.stringify(cachePayload);

            // A. Save the unique record (storageFilename)
            await saveFileToDirectory(downloadHandle, storageFilename, contentStr);

            // B. If unnamed OR named, we update the cache file so we can reload it next time.
            if (storageFilename !== cacheFilename) {
              await saveFileToDirectory(downloadHandle, cacheFilename, contentStr);
            }

            // C. Log the UNIQUE filename to CSV
            const country = locationInfo?.fullName ? locationInfo.fullName.split(',').pop()?.trim() || 'Unknown' : (searchQuery ? searchQuery.split(',').pop()?.trim() || 'Unknown' : 'Unknown');
            const logEntry: LogEntry = {
              name: safeName,
              country: country,
              coordinates: selectedPolygon[0] ? `${selectedPolygon[0][0].toFixed(5)},${selectedPolygon[0][1].toFixed(5)}` : '',
              area: areaKm2.toFixed(4),
              fileLink: storageFilename, // Point to the permanent record
              timestamp: new Date().toISOString()
            };
            await appendToCSV(downloadHandle, 'viewed_models.csv', logEntry);
          }
        } catch (storageErr: any) {
          if (storageErr.message === 'HANDLE_INVALIDATED') {
            console.warn("File System Handle invalidated. Clearing handle.");
            setDownloadHandle(null);
            alert("The connection to the saving folder was lost. Please link the folder again.");
          } else {
            console.warn("Non-critical storage error during preview cache:", storageErr);
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load preview.");
      setShowPreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  /**
   * Save the rendered image and update CSV
   */
  const handleSaveRender = async (imageUrl: string) => {
    if (!downloadHandle || !previewFileLink) return;

    try {
      const hasPerm = await verifyPermission(downloadHandle, true);
      if (!hasPerm) return;

      // Create 'render' directory
      const renderDir = await downloadHandle.getDirectoryHandle('render', { create: true });

      // Generate filename
      const baseName = previewFileLink.replace('.json', '');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${baseName}_render_${timestamp}.png`;

      // Convert data URL to Blob
      const res = await fetch(imageUrl);
      const blob = await res.blob();

      // Save
      await saveFileToDirectory(renderDir, filename, blob);

      // Update CSV
      const relativePath = `render/${filename}`;
      await updateLogWithRender(downloadHandle, 'viewed_models.csv', previewFileLink, relativePath);

      console.log("Render saved automatically to", relativePath);

    } catch (e) {
      console.error("Failed to save render automatically", e);
      setErrorMessage("Failed to save render automatically.");
    }
  };

  /**
   * Download the model after preview confirmation
   */
  const handleDownloadFromPreview = async () => {
    setShowPreview(false);
    await handleDownload();
  };

  /**
   * Download OSM Data
   */
  const handleDownloadOSM = () => {
    if (!selectedPolygon || selectedPolygon.length === 0) return;

    const lats = selectedPolygon.map(p => p[0]);
    const lons = selectedPolygon.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // OSM API uses bbox=minLon,minLat,maxLon,maxLat
    const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${minLon},${minLat},${maxLon},${maxLat}`;

    // Create a temporary hidden iframe to trigger the download without opening a new tab
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Clean up independently
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 60000); // 1 minute timeout to allow download to start
  };

  /**
   * Direct download without preview
   */
  const handleDownload = async () => {
    if (!apiKey || !selectedPolygon) {
      if (!apiKey) {
        setErrorMessage("Cityweft API Key is required.");
        setShowApiModal(true);
      }
      return;
    }

    setStatus(AppStatus.PREPARING);
    setProgress(5);
    setErrorMessage(null);

    try {
      // Use the config filename if set
      let currentFilename = exportConfig.filename;

      const isUnnamed = !searchQuery || searchQuery.trim() === '';
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');

      if (!currentFilename || currentFilename.trim() === '') {
        if (isUnnamed) {
          currentFilename = `unnamed_region_${dateStr}`;
        } else {
          // Fallback to location info or search query if filename is empty but we have location data
          const refName = locationInfo?.fullName || searchQuery;
          currentFilename = refName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
        }
      } else {
        // If user manually kept "unnamed_region" or it was auto-set and not changed
        if (currentFilename === 'unnamed_region' || currentFilename.startsWith('unnamed_region')) {
          if (currentFilename === 'unnamed_region') {
            currentFilename = `unnamed_region_${dateStr}`;
          }
        }
      }

      const payload: CityweftPayload = {
        polygon: selectedPolygon,
        settings: {
          ...settings,
          topographyReturnType: settings.topographyModel ? 'elevationMap' : null
        },
        export: {
          format: exportConfig.format === 'rhino' ? '3dm' as any : exportConfig.format,
          version: exportConfig.version
        },
        requestId: crypto.randomUUID(),
        timestamp: Date.now()
      };

      setProgress(20);
      setStatus(AppStatus.REQUESTING);
      const downloadUrl = await requestCityweftData(payload, apiKey);

      setProgress(50);
      setStatus(AppStatus.PROCESSING);
      const ext = exportConfig.format === 'rhino' ? '3dm' : exportConfig.format;
      const finalFilename = `${currentFilename}.${ext}`;

      setStatus(AppStatus.DOWNLOADING);
      setProgress(80);

      // Check if we can save locally
      if (downloadHandle) {
        const hasPerm = await verifyPermission(downloadHandle, true);
        if (hasPerm) {
          const res = await fetch(downloadUrl);
          const blob = await res.blob();
          await saveFileToDirectory(downloadHandle, finalFilename, blob);
        } else {
          // Fallback
          await downloadFile(downloadUrl, finalFilename);
        }
      } else {
        await downloadFile(downloadUrl, finalFilename);
      }

      setProgress(100);
      setStatus(AppStatus.SUCCESS);
      setTimeout(() => { setStatus(AppStatus.IDLE); setProgress(0); }, 5000);
    } catch (err: any) {
      setStatus(AppStatus.ERROR);
      setErrorMessage(err.message || "Extraction failed.");
    }
  };

  const handleFileUpload = async () => {
    try {
      // @ts-ignore
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Cityweft JSON Preview',
            accept: {
              'application/json': ['.json']
            }
          }
        ],
        multiple: false
      });

      const file = await fileHandle.getFile();
      await processLoadedFile(file);

    } catch (e: any) {
      // Fallback to hidden input if API not supported or cancelled
      if (e.name === 'AbortError') return; // User cancelled

      if (!('showOpenFilePicker' in window)) {
        fileInputRef.current?.click();
        return;
      }

      console.error("File upload failed:", e);
      setErrorMessage("Failed to load file. Please ensure it is a valid Cityweft JSON preview.");
    }
  };

  const processLoadedFile = async (file: File) => {
    try {
      const text = await file.text();
      let json = JSON.parse(text);
      let data = json;

      // Check for wrapped format
      if (json.sourcePolygon && json.data) {
        data = json.data;
      }

      if (!data.geometry && !data.origin) {
        throw new Error("Invalid file format");
      }

      setPreviewData(data);
      if (json.sourcePolygon) {
        setLastPreviewedPolygon(json.sourcePolygon);
      }
      setShowPreview(true);
      setPreviewFileLink(file.name);

      // Extract and focus on polygon if available
      if (json.sourcePolygon) {
        const polygon: [number, number][] = json.sourcePolygon;
        setSelectedPolygon(polygon);

        // Calculate center to fly to
        if (polygon.length > 0) {
          const lats = polygon.map(p => p[0]);
          const lons = polygon.map(p => p[1]);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);
          const centerLat = (minLat + maxLat) / 2;
          const centerLon = (minLon + maxLon) / 2;

          // Fly to location
          setMapFlyTo([centerLat, centerLon]);

          // Calculate Area
          const area = calculateAreaFromPolygon(polygon);
          setAreaKm2(area);

          // Update location info
          reverseGeocode(centerLat, centerLon).then(info => {
            if (info) {
              setLocationInfo(info);
              const safeFullName = info.fullName.replace(/[^a-zA-Z0-9\s-_]/g, '').replace(/\s+/g, '_');
              setExportConfig(prev => ({ ...prev, filename: safeFullName }));
            }
          });
        }
      }

    } catch (e) {
      console.error("File processing error:", e);
      setErrorMessage("Failed to process file. Invalid JSON format.");
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processLoadedFile(file);
    }
    // Reset input
    if (event.target) event.target.value = '';
  };

  return (
    <div className="relative h-screen w-screen bg-[#020617] flex overflow-hidden selection:bg-blue-500/30">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept=".json"
      />
      {/* Floating Search Hub */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[1400] w-[440px] h-12 pointer-events-none" ref={searchRef}>
        <div className="glass-panel rounded-[32px] p-1 flex items-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] pointer-events-auto transition-all duration-500 hover:ring-2 hover:ring-blue-500/20 focus-within:ring-2 focus-within:ring-blue-500/50">
          <div className="flex items-center gap-3 px-3 py-1.5 flex-grow min-w-0">
            {isSearching ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" /> : <Search className="w-5 h-5 text-slate-500" />}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find city..."
              className="bg-transparent border-none outline-none text-sm text-slate-100 placeholder:text-slate-400 w-full font-semibold"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 px-1 border-l border-white/5">
            <button
              onClick={() => {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setMapFlyTo([pos.coords.latitude, pos.coords.longitude]);
                });
              }}
              className="p-2 hover:bg-white/10 rounded-2xl transition-all text-slate-500 hover:text-blue-400 active:scale-90"
            >
              <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-[60px] left-0 w-[440px] glass-panel !bg-slate-800/90 rounded-[24px] overflow-hidden shadow-2xl pointer-events-auto border border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
            {suggestions.map((item, index) => (
              <button
                key={index}
                onClick={() => handleSelectLocation(item.lat, item.lon, item.display_name)}
                className="w-full text-left px-6 py-4 hover:bg-blue-500/10 transition-colors flex flex-col group border-b border-white/5 last:border-none"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-white font-bold truncate group-hover:text-blue-400 transition-colors">{item.display_name}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1 group-hover:text-blue-400/70 transition-colors">{item.type || 'Location'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <ControlPanel
        settings={settings}
        setSettings={setSettings}
        exportConfig={exportConfig}
        setExportConfig={setExportConfig}
        status={status}
        progress={progress}
        errorMessage={errorMessage}
        onDownload={handleDownload}
        onPreview={handlePreview}
        selectedArea={areaKm2}
        onClearSelection={handleClearSelection}
        canDownload={!!selectedPolygon && areaKm2 > 0 && areaKm2 <= 5 && !!apiKey}
        onOpenApiKeyModal={() => setShowApiModal(true)}
        hasApiKey={!!apiKey}
        onFileUpload={handleFileUpload}
        onDownloadOSM={handleDownloadOSM}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        nanoBananaApiKey={nanoBananaApiKey}
        setNanoBananaApiKey={setNanoBananaApiKey}
        downloadPathName={downloadPathName}
        onSelectDownloadFolder={handleSelectDownloadFolder}
      />

      {/* Model Preview Modal */}
      <ModelPreview
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
        }}
        geometryData={previewData}
        onConfirmDownload={handleDownloadFromPreview}
        isLoading={isLoadingPreview}
        nanoBananaApiKey={nanoBananaApiKey}
        locationName={locationInfo?.fullName || searchQuery}
        onRenderComplete={handleSaveRender}
      />

      <main className="flex-grow relative h-full">
        <MapViewer
          onPolygonChange={handlePolygonChange}
          flyTo={mapFlyTo}
          clearTrigger={clearTrigger}
          externalPolygon={selectedPolygon}
          locationName={locationInfo?.shortName || null}
        />
      </main>
    </div>
  );
};

export default App;
