import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  X, RotateCcw, Eye, Download, Loader2, Image as ImageIcon,
  Box, Edit2, Check, ChevronDown, Layers, ChevronLeft, EyeOff, Sun, ChevronRight, Wind, Thermometer, Compass
} from 'lucide-react';
import { generateRender, GeminiModel } from '../services/nanobanana';
import { fetchClimateData } from '../services/climate';
import SunCalc from 'suncalc';

interface GeometryData {
  type: string;
  geometryType: string;
  meshes?: Array<{
    vertices: number[];
    descriptor?: {
      type?: string;
      pathType?: string;
      id?: string;
      [key: string]: any;
    };
  }>;
  nodes?: Array<{
    type?: string;
    x?: number;
    y?: number;
    z?: number;
    scale?: number;
    rotation?: number;
    [key: string]: any;
  }>;
}

interface ApiResponse {
  origin: [number, number];
  geometry: GeometryData[];
}

interface ModelPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  geometryData: ApiResponse | null;
  onConfirmDownload: () => void;
  isLoading?: boolean;
  nanoBananaApiKey?: string;
  locationName?: string;
  onRenderComplete?: (imageUrl: string) => void;
}

const COLORS = {
  buildings: '#FFFFFF',
  surface: {
    roadway: '#808080',
    asphalt: '#333333',
    roadwayIntersection: '#444444',
    roadwayArea: '#555555',
    pavement: '#B092BC',
    footway: '#B092BC',
    water: '#ADD8E6',
    grass: '#7CFC00',
    manicuredGrass: '#006400',
    farmland: '#C19A6B',
    sand: '#F4A460',
    rock: '#808080',
    pitch: '#32CD32',
    helipad: '#696969',
    forest: '#228B22',
    garden: '#9ACD32',
    construction: '#FFA500',
    buildingConstruction: '#FF4500',
    shrubbery: '#8FBC8F',
    default: '#CCCCCC'
  },
  infrastructure: {
    tree: '#228B22',
    shrubbery: '#8FBC8F',
    bench: '#A0522D',
    utilityPole: '#696969',
    default: '#AAAAAA'
  },
  barriers: '#8B4513',
  topography: '#654321'
};

const ModelPreview: React.FC<ModelPreviewProps> = ({
  isOpen,
  onClose,
  geometryData,
  onConfirmDownload,
  isLoading = false,
  nanoBananaApiKey,
  locationName,
  onRenderComplete
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const layerGroupsRef = useRef<Record<string, THREE.Group>>({});
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const [stats, setStats] = useState({ meshCount: 0, vertexCount: 0 });

  // Rendering State
  const [activeTab, setActiveTab] = useState<'3d' | 'render'>('3d');
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Prompt Editing State
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [promptOverride, setPromptOverride] = useState<string>("");
  const [tempPrompt, setTempPrompt] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-3-pro-image-preview');
  const [renderQuality, setRenderQuality] = useState<'1K' | '2K' | '4K'>('1K');

  // Layer Control State
  const [showLayers, setShowLayers] = useState(true);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({});
  const [layerVisibility, setLayerVisibility] = useState({
    buildings: true,
    surface: {
      _group: true,
      roadway: true,
      asphalt: true,
      roadwayIntersection: true,
      roadwayArea: true,
      pavement: true,
      footway: true,
      water: true,
      grass: true,
      manicuredGrass: true,
      farmland: true,
      sand: true,
      rock: true,
      pitch: true,
      helipad: true,
      forest: true,
      garden: true,
      construction: true,
      buildingConstruction: true,
      shrubbery: true,
      default: true
    },
    vegetation: true,
    infrastructure: true,
    barriers: true,
    topography: true
  });

  // Sun Study State
  const [timeOfDay, setTimeOfDay] = useState(12); // 12:00 PM default
  const [isSunStudyEnabled, setIsSunStudyEnabled] = useState(false);
  const [showDefaultShadows, setShowDefaultShadows] = useState(true);
  const [showSunControls, setShowSunControls] = useState(false);
  const [showSolarPath, setShowSolarPath] = useState(false);
  const solarHelperRef = useRef<THREE.Group | null>(null);

  // Climate State
  const [climateData, setClimateData] = useState<{
    current: { temperature: number; windSpeed: number; windDirection: number; };
    hourly: Array<{ time: string; temperature: number; windSpeed: number; windDirection: number; }>;
  } | null>(null);

  const [isClimateEnabled, setIsClimateEnabled] = useState(false);
  const windHelperRef = useRef<THREE.Group | null>(null);
  const [sceneGeneration, setSceneGeneration] = useState(0);

  useEffect(() => {
    // Reset analysis states when geometry data changes
    setPromptOverride("");
    setIsSunStudyEnabled(false);
    setShowSolarPath(false);
    setIsClimateEnabled(false);
  }, [geometryData]);

  // Update Grid/Layer Visibility
  useEffect(() => {
    Object.entries(layerVisibility).forEach(([key, visible]) => {
      const group = layerGroupsRef.current[key];
      if (group) {
        if (key === 'surface' && typeof visible === 'object') {
          // Handle Surface Sublayers
          group.visible = visible._group; // Main group visibility

          // Toggle individual children based on their userData type
          group.children.forEach(child => {
            const type = child.userData.subtype || 'default';
            const isSubVisible = (visible as any)[type] !== undefined ? (visible as any)[type] : true;
            child.visible = isSubVisible;
          });

        } else {
          // Standard Boolean Toggle
          group.visible = visible as boolean;
        }
      }
    });
  }, [layerVisibility]);

  // Fetch Climate Data
  useEffect(() => {
    if (geometryData?.origin) {
      const [lat, lon] = geometryData.origin;
      fetchClimateData(lat, lon).then(data => {
        if (data) {
          setClimateData(data);
        }
      });
    }
  }, [geometryData]);

  // Handle Wind Visualization
  useEffect(() => {
    if (!sceneRef.current || !climateData || !meshGroupRef.current) return;

    // Clean up old helper
    if (windHelperRef.current) {
      sceneRef.current.remove(windHelperRef.current);
      // specific cleanup for meshes/materials if needed, but Group remove is usually enough for simple helpers
      // ArrowHelper creates geometry/materials, ideally we dispose them
      windHelperRef.current.traverse((child: any) => {
        if (child instanceof THREE.ArrowHelper) {
          child.line.geometry.dispose();
          child.cone.geometry.dispose();
          if (child.line.material) {
            if (Array.isArray(child.line.material)) child.line.material.forEach((m: any) => m.dispose());
            else child.line.material.dispose();
          }
          if (child.cone.material) {
            if (Array.isArray(child.cone.material)) child.cone.material.forEach((m: any) => m.dispose());
            else child.cone.material.dispose();
          }
        }
      });
      windHelperRef.current = null;
    }

    if (isClimateEnabled) {
      const group = new THREE.Group();

      // Get data for the current time of day
      // timeOfDay is a float (e.g. 14.5 for 2:30 PM)
      // We need to find the closest hour index.
      // Assuming hourly data starts at 00:00 today.
      const hourIndex = Math.round(timeOfDay) % 24;
      const currentHourData = climateData.hourly[hourIndex] || climateData.current;

      const dirRad = THREE.MathUtils.degToRad(currentHourData.windDirection);
      // North is -Z, East is +X. Wind direction is deg clockwise from North.
      // 0 = North (-Z) -> x=0, z=-1
      // 90 = East (+X) -> x=1, z=0
      const x = Math.sin(dirRad);
      const z = -Math.cos(dirRad);
      const dir = new THREE.Vector3(x, 0, z).normalize();

      const box = new THREE.Box3().setFromObject(meshGroupRef.current);
      const size = box.getSize(new THREE.Vector3());
      const min = box.min;

      // Create a grid of arrows
      const hex = 0x0ea5e9; // Sky Blue

      // Grid configuration
      const cols = 6;
      const rows = 6;
      const padding = 0.1; // 10% padding from edges

      const stepX = size.x * (1 - 2 * padding) / (cols - 1);
      const stepZ = size.z * (1 - 2 * padding) / (rows - 1);
      const length = Math.min(stepX, stepZ) * 0.6; // Arrow length based on cell size

      const startX = min.x + size.x * padding;
      const startZ = min.z + size.z * padding;
      const yPos = box.max.y + 20; // 20 units above max height

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const origin = new THREE.Vector3(
            startX + i * stepX,
            yPos,
            startZ + j * stepZ
          );

          const arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex, length * 0.3, length * 0.2);
          group.add(arrowHelper);
        }
      }

      sceneRef.current.add(group);
      windHelperRef.current = group;
    }

  }, [isClimateEnabled, climateData, timeOfDay, sceneGeneration]);

  // Handle Sun Position Updates
  useEffect(() => {
    if (!sunLightRef.current || !meshGroupRef.current) return;

    if (!isSunStudyEnabled) {
      // Reset to default lighting
      const box = new THREE.Box3().setFromObject(meshGroupRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Position light nicely relative to center
      sunLightRef.current.position.set(center.x + 100, center.y + 200, center.z + 50);
      sunLightRef.current.target.position.copy(center);
      sunLightRef.current.target.updateMatrixWorld();

      // Control Shadow Casting for Default Light
      sunLightRef.current.castShadow = showDefaultShadows;

      // Reset shadow camera to cover everything (optional, but good for consistency)
      const camSize = maxDim * 0.8;
      sunLightRef.current.shadow.camera.left = -camSize;
      sunLightRef.current.shadow.camera.right = camSize;
      sunLightRef.current.shadow.camera.top = camSize;
      sunLightRef.current.shadow.camera.bottom = -camSize;
      sunLightRef.current.shadow.camera.updateProjectionMatrix();

      // Reset Standard Background
      if (sceneRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        if (context) {
          const gradient = context.createLinearGradient(0, 0, 0, 512);
          gradient.addColorStop(0, '#3b82f6'); // Zenith (Blue)
          gradient.addColorStop(1, '#e0f2fe'); // Horizon (White/Light Blue)
          context.fillStyle = gradient;
          context.fillRect(0, 0, 2, 512);
          const texture = new THREE.CanvasTexture(canvas);
          sceneRef.current.background = texture;
        }
      }

      // Force shadow update if needed
      if (rendererRef.current) {
        rendererRef.current.shadowMap.needsUpdate = true;
      }

      return;
    }

    // Force shadows ON when Sun Study is active (it implies shadows)
    sunLightRef.current.castShadow = true;

    if (!geometryData?.origin) return;

    const [lat, lon] = geometryData.origin;
    const date = new Date();
    // Set time based on slider (hours)
    date.setHours(Math.floor(timeOfDay));
    date.setMinutes((timeOfDay % 1) * 60);

    const sunPos = SunCalc.getPosition(date, lat, lon);

    // Convert Azimuth/Altitude to XYZ
    const phi = Math.PI / 2 - sunPos.altitude;
    const theta = sunPos.azimuth;

    // Calculate Scene Bounds for adaptive shadow camera
    const box = new THREE.Box3().setFromObject(meshGroupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Spherical to Cartesian relative to scene center
    const r = maxDim * 1.5;
    // South is +Z, West is -X, North is -Z, East is +X. (Standard Map Orientation)
    // SunCalc: 0=S, PI/2=W, PI=N
    // We want 0 -> +Z, PI/2 -> -X
    const x = -r * Math.sin(phi) * Math.sin(theta);
    const y = r * Math.cos(phi);
    const z = r * Math.sin(phi) * Math.cos(theta);

    sunLightRef.current.position.set(center.x + x, center.y + y, center.z + z);
    sunLightRef.current.target.position.copy(center);
    sunLightRef.current.target.updateMatrixWorld();

    // Adapt Shadow Camera to scene size
    const camSize = maxDim * 0.8; // Cover the scene
    sunLightRef.current.shadow.camera.left = -camSize;
    sunLightRef.current.shadow.camera.right = camSize;
    sunLightRef.current.shadow.camera.top = camSize;
    sunLightRef.current.shadow.camera.bottom = -camSize;
    sunLightRef.current.shadow.camera.near = 10;
    sunLightRef.current.shadow.camera.far = r * 3;
    sunLightRef.current.shadow.camera.updateProjectionMatrix();

    // Update background color based on time of day (simple approximation)
    if (sceneRef.current) {
      // Adjust background for day/night cycle
      const isNight = sunPos.altitude < -0.1; // Below horizon
      const isDusk = sunPos.altitude < 0.1 && sunPos.altitude >= -0.1;

      let topColor = '#3b82f6';
      let bottomColor = '#e0f2fe';

      if (isNight) {
        topColor = '#0f172a'; // Dark slate
        bottomColor = '#1e293b';
      } else if (isDusk) {
        topColor = '#4f46e5'; // Indigo
        bottomColor = '#fcd34d'; // Amber
      }

      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, topColor);
        gradient.addColorStop(1, bottomColor);
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        const texture = new THREE.CanvasTexture(canvas);
        sceneRef.current.background = texture;
      }
    }

  }, [timeOfDay, geometryData, isSunStudyEnabled, sceneGeneration, showDefaultShadows]);

  // Handle Solar Path Visualization (Arc and Compass)
  useEffect(() => {
    if (!sceneRef.current || !meshGroupRef.current) return;

    // Cleanup old helper always first
    if (solarHelperRef.current) {
      sceneRef.current.remove(solarHelperRef.current);
      solarHelperRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
          else child.material.dispose();
        }
      });
      solarHelperRef.current = null;
    }

    // Allow visualization even if sun study is disabled (as per user request)
    // if (!isSunStudyEnabled) return;

    // Only proceed if showSolarPath is ALSO true (and sun study is enabled)
    if (!showSolarPath || !geometryData?.origin) return;

    const [lat, lon] = geometryData.origin;
    const group = new THREE.Group();
    const box = new THREE.Box3().setFromObject(meshGroupRef.current);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z);
    const radius = maxDim * 1.2;

    // 1. Ground Compass / Grid
    const compassGroup = new THREE.Group();

    // Circular rings
    for (let r = 0.5; r <= 1.0; r += 0.25) {
      const ringGeo = new THREE.RingGeometry(radius * r - 0.5, radius * r + 0.5, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x64748b, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = box.min.y;
      compassGroup.add(ring);
    }

    // Cardinal Lines (N, S, E, W)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.5 });

    // N-S Line (Now on Z axis)
    const nsPoints = [new THREE.Vector3(0, box.min.y, -radius), new THREE.Vector3(0, box.min.y, radius)];
    const nsGeo = new THREE.BufferGeometry().setFromPoints(nsPoints);
    compassGroup.add(new THREE.Line(nsGeo, lineMat));

    // E-W Line (Now on X axis)
    const ewPoints = [new THREE.Vector3(-radius, box.min.y, 0), new THREE.Vector3(radius, box.min.y, 0)];
    const ewGeo = new THREE.BufferGeometry().setFromPoints(ewPoints);
    compassGroup.add(new THREE.Line(ewGeo, lineMat));

    // Helper to create text sprite
    const createTextSprite = (text: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Group();
      canvas.width = 128;
      canvas.height = 128;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(radius * 0.2, radius * 0.2, 1);
      return sprite;
    };

    // Labels (N, S, E, W) - Corrected for Map-Up=North (-Z)
    const labelPoints = [
      { pos: [0, 0, -radius * 1.1], label: 'N' },
      { pos: [0, 0, radius * 1.1], label: 'S' },
      { pos: [radius * 1.1, 0, 0], label: 'E' },
      { pos: [-radius * 1.1, 0, 0], label: 'W' }
    ];

    labelPoints.forEach(p => {
      const sprite = createTextSprite(p.label);
      sprite.position.set(p.pos[0], 0, p.pos[2]);
      compassGroup.add(sprite);
    });

    compassGroup.position.set(center.x, box.min.y, center.z);
    group.add(compassGroup);

    // 2. Solar Path (Arc)
    const pathPoints: THREE.Vector3[] = [];
    const date = new Date();

    // Sample from 4:00 AM to 8:00 PM
    for (let h = 4; h <= 20; h += 0.25) {
      date.setHours(Math.floor(h));
      date.setMinutes((h % 1) * 60);

      const pos = SunCalc.getPosition(date, lat, lon);
      if (pos.altitude > -0.1) { // Only points near or above horizon
        const phi = Math.PI / 2 - pos.altitude;
        const theta = pos.azimuth;

        // X = East-West, Z = North-South
        // South (0) -> +Z, West (PI/2) -> -X
        const x = -radius * Math.sin(phi) * Math.sin(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.cos(theta);

        pathPoints.push(new THREE.Vector3(center.x + x, box.min.y + y, center.z + z));
      }
    }

    if (pathPoints.length > 1) {
      const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
      const pathMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2, transparent: true, opacity: 0.6 });
      const pathLine = new THREE.Line(pathGeo, pathMat);
      group.add(pathLine);
    }

    // 3. The Sun Ball
    const sunBallGeo = new THREE.SphereGeometry(radius * 0.05, 32, 32);
    const sunBallMat = new THREE.MeshStandardMaterial({
      color: 0xffcc33,
      emissive: 0xff9900,
      emissiveIntensity: 1
    });
    const sunBall = new THREE.Mesh(sunBallGeo, sunBallMat);

    // Current Sun Position
    const currentHour = Math.floor(timeOfDay);
    const currentMin = (timeOfDay % 1) * 60;
    const curDate = new Date();
    curDate.setHours(currentHour);
    curDate.setMinutes(currentMin);

    const curSunPos = SunCalc.getPosition(curDate, lat, lon);
    const curPhi = Math.PI / 2 - curSunPos.altitude;
    const curTheta = curSunPos.azimuth;

    // South is +Z, West is -X
    const sunX = -radius * Math.sin(curPhi) * Math.sin(curTheta);
    const sunY = radius * Math.cos(curPhi);
    const sunZ = radius * Math.sin(curPhi) * Math.cos(curTheta);

    sunBall.position.set(center.x + sunX, box.min.y + sunY, center.z + sunZ);
    group.add(sunBall);

    // Add a "light beam" line from sun to center
    const beamPoints = [new THREE.Vector3(center.x, box.min.y, center.z), sunBall.position.clone()];
    const beamGeo = new THREE.BufferGeometry().setFromPoints(beamPoints);
    const beamMat = new THREE.LineDashedMaterial({
      color: 0xffcc33,
      dashSize: 2,
      gapSize: 1,
      transparent: true,
      opacity: 0.3
    });
    const beam = new THREE.Line(beamGeo, beamMat);
    beam.computeLineDistances();
    group.add(beam);

    sceneRef.current.add(group);
    solarHelperRef.current = group;

  }, [showSolarPath, timeOfDay, geometryData, isSunStudyEnabled, sceneGeneration]);


  const generateDefaultPrompt = () => {
    let smartPrompt = "Photorealistic render of an urban environment, architectural visualization, high fidelity to input layout, realistic building facades and textures, organic tree canopy, do not add new buildings, respect camera view and perspective, cinematic lighting, highly detailed, 8k resolution, day lighting";

    if (locationName) {
      smartPrompt = `Photorealistic render of ${locationName}, urban context, accurate architectural style, high fidelity to input layout, realistic materials, organic vegetation, do not add new buildings, respect camera view and perspective, cinematic lighting, 8k resolution`;
    }

    if (geometryData?.origin) {
      smartPrompt += `, located at coordinates ${geometryData.origin[0]}, ${geometryData.origin[1]}`;
    }
    return smartPrompt;
  };

  const handleOpenPromptEditor = () => {
    const currentPrompt = promptOverride || generateDefaultPrompt();
    setTempPrompt(currentPrompt);
    setShowPromptEditor(true);
  };

  const handleSavePrompt = () => {
    setPromptOverride(tempPrompt);
    setShowPromptEditor(false);
  };

  // Map Underlay State
  const [showMapUnderlay, setShowMapUnderlay] = useState(false);
  const mapGroupRef = useRef<THREE.Group | null>(null);

  // Handle Map Underlay
  useEffect(() => {
    if (!sceneRef.current || !meshGroupRef.current || !geometryData?.origin) return;

    // Cleanup
    if (mapGroupRef.current) {
      sceneRef.current.remove(mapGroupRef.current);
      mapGroupRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      mapGroupRef.current = null;
    }

    if (showMapUnderlay) {
      const [lat, lon] = geometryData.origin;
      const group = new THREE.Group();

      const box = new THREE.Box3().setFromObject(meshGroupRef.current);
      if (box.isEmpty()) return; // Safety check

      const groundY = box.min.y - 0.5; // Slightly below lowest point

      const sizeX = box.max.x - box.min.x;
      const sizeZ = box.max.z - box.min.z;
      const maxDim = Math.max(sizeX, sizeZ);

      // Dynamic Zoom Calculation
      // We want the total grid to be manageable (e.g. ~8-12 tiles wide)
      // Tile size in pixels = 256
      // Meters per pixel ~ 156543 / 2^zoom * cos(lat)
      // TileMeters = Meters/Pixel * 256

      const EARTH_CIRCUMFERENCE = 40075016.686;
      const latRad = lat * Math.PI / 180;
      const cosLat = Math.cos(latRad);

      // Find zoom where maxDim fits in roughly 10 tiles (less aggressive zoom to avoid huge tile counts)
      // tileMeters * 10 approx maxDim
      let targetZoom = Math.floor(Math.log2((10 * 256 * EARTH_CIRCUMFERENCE * cosLat) / (maxDim || 100)) - 8);
      // Clamp zoom to reasonable web map levels (15-19)
      const zoom = Math.max(15, Math.min(19, targetZoom));

      const metersPerPixel = (EARTH_CIRCUMFERENCE * cosLat) / Math.pow(2, zoom + 8);
      const tileMeters = metersPerPixel * 256;

      // Coordinate conversion
      const n = Math.pow(2, zoom);
      const xTileFloat = n * ((lon + 180) / 360);
      const yTileFloat = n * (1 - (Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI)) / 2;

      // Pixel position of the Center Point (lon, lat) within the world map at this zoom
      const centerPixelX = xTileFloat * 256;
      const centerPixelY = yTileFloat * 256;

      // Helper: Convert World Position (meters relative to model origin) to Absolute Tile Index
      // World X is East (+), Pixel X is East (+)
      // World Z is South (+), Pixel Y is South (+)
      const getTileIndexX = (worldX: number) => Math.floor((centerPixelX + (worldX / metersPerPixel)) / 256);
      const getTileIndexY = (worldZ: number) => Math.floor((centerPixelY + (worldZ / metersPerPixel)) / 256);

      // Calculate range of tiles needed to cover the box
      const minTx = getTileIndexX(box.min.x);
      const maxTx = getTileIndexX(box.max.x);
      const minTy = getTileIndexY(box.min.z);
      const maxTy = getTileIndexY(box.max.z);

      // Add generous padding
      const pad = 3;

      // Safety check
      const tileCount = (maxTx - minTx + 1 + 2 * pad) * (maxTy - minTy + 1 + 2 * pad);
      if (tileCount > 300) {
        console.warn(`Many map tiles requested (${tileCount}), performance may be impacted.`);
      }

      const loader = new THREE.TextureLoader();
      loader.crossOrigin = 'anonymous';

      // Load tiles based on absolute indices
      let loadedCount = 0;
      for (let tx = minTx - pad; tx <= maxTx + pad; tx++) {
        for (let ty = minTy - pad; ty <= maxTy + pad; ty++) {
          if (loadedCount >= 300) break; // Hard cap increased
          loadedCount++;

          const url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;

          const texture = loader.load(url);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;

          const maxAnisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() || 4;
          texture.anisotropy = Math.min(16, maxAnisotropy);

          const geometry = new THREE.PlaneGeometry(tileMeters, tileMeters);
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          mesh.receiveShadow = true;

          // Position in World Space
          // Tile's top-left pixel coord = tx * 256
          // Tile's center pixel coord = tx * 256 + 128
          // Offset from Center Point (pixels) = (tx * 256 + 128) - centerPixelX
          // Convert to meters: * metersPerPixel

          const tileCenterPixelX = tx * 256 + 128;
          const tileCenterPixelY = ty * 256 + 128;

          const worldX = (tileCenterPixelX - centerPixelX) * metersPerPixel;
          const worldZ = (tileCenterPixelY - centerPixelY) * metersPerPixel;

          mesh.position.set(worldX, groundY, worldZ);
          group.add(mesh);
        }
      }

      sceneRef.current.add(group);
      mapGroupRef.current = group;
    }
  }, [showMapUnderlay, geometryData, sceneGeneration]);

  const handleSliderMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPosition(Math.min(100, Math.max(0, position)));
  };

  const handleRender = async () => {
    if (!rendererRef.current || !nanoBananaApiKey) return;

    setIsRendering(true);
    setRenderError(null);
    setRenderedImageUrl(null);
    setActiveTab('render');

    try {
      // Hide Helpers for clean capture
      const wasSolarVisible = solarHelperRef.current?.visible;
      const wasWindVisible = windHelperRef.current?.visible;

      if (solarHelperRef.current) solarHelperRef.current.visible = false;
      if (windHelperRef.current) windHelperRef.current.visible = false;

      // Capture current view at high resolution (1376x768)
      // Store original size and aspect
      const originalSize = new THREE.Vector2();
      rendererRef.current.getSize(originalSize);
      const originalAspect = cameraRef.current.aspect;

      // Set high-res target size
      const targetWidth = 1376;
      const targetHeight = 768;

      // Resize renderer (buffer only, not style)
      rendererRef.current.setSize(targetWidth, targetHeight, false);
      if (cameraRef.current) {
        cameraRef.current.aspect = targetWidth / targetHeight;
        cameraRef.current.updateProjectionMatrix();
      }
      if (sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      const canvas = rendererRef.current.domElement;
      const dataUrl = canvas.toDataURL('image/png');

      // Restore original size and aspect
      rendererRef.current.setSize(originalSize.x, originalSize.y, false);
      if (cameraRef.current) {
        cameraRef.current.aspect = originalAspect;
        cameraRef.current.updateProjectionMatrix();
      }

      // Restore Helpers
      if (solarHelperRef.current && wasSolarVisible !== undefined) solarHelperRef.current.visible = wasSolarVisible;
      if (windHelperRef.current && wasWindVisible !== undefined) windHelperRef.current.visible = wasWindVisible;

      if (sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      setOriginalImageUrl(dataUrl); // Set immediate preview

      const blob = await (await fetch(dataUrl)).blob();

      // Construct Smart Prompt
      const smartPrompt = promptOverride || generateDefaultPrompt();

      const qualityToUse = selectedModel === 'gemini-3-pro-image-preview' ? renderQuality : '1K';

      console.log(`Generating render with prompt (${selectedModel}, ${qualityToUse}):`, smartPrompt);

      const result = await generateRender(blob, smartPrompt, nanoBananaApiKey, selectedModel, qualityToUse);

      if (result.status === 'success') {
        setRenderedImageUrl(result.imageUrl);
        if (onRenderComplete) {
          onRenderComplete(result.imageUrl);
        }
      } else {
        setRenderError(result.error || "Rendering failed");
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !containerRef.current || !geometryData) return;

    // Scene setup
    const scene = new THREE.Scene();
    // Initial Background
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 512);
      gradient.addColorStop(0, '#3b82f6'); // Zenith (Blue)
      gradient.addColorStop(1, '#e0f2fe'); // Horizon (White/Light Blue)
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2, 512);
      const texture = new THREE.CanvasTexture(canvas);
      scene.background = texture;
    } else {
      scene.background = new THREE.Color(0xe0f2fe);
    }
    sceneRef.current = scene;
    setSceneGeneration(g => g + 1);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000 // Increased far clipping plane
    );
    camera.position.set(50, 80, 50);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true // Required for screenshot capture
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; // Enable shadows for sun study
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25; // Increase damping to stop movement faster
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x0f172a, 0.4); // Sky color, Ground color, Intensity
    scene.add(hemisphereLight);

    // Sun Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096; // High res shadow map
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.left = -300;
    directionalLight.shadow.camera.right = 300;
    directionalLight.shadow.camera.top = 300;
    directionalLight.shadow.camera.bottom = -300;
    directionalLight.shadow.bias = -0.0005; // Reduce shadow acne
    scene.add(directionalLight);
    sunLightRef.current = directionalLight; // Store ref for updating position

    // Add Fill Light for better 3D readability with white buildings
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(-100, 50, -100);
    scene.add(fillLight);

    // Process geometry
    const meshGroup = new THREE.Group();
    // Rotate 90 degrees to align North (+X in data) to -Z (Standard Map North)
    meshGroup.rotation.y = Math.PI / 2;
    meshGroupRef.current = meshGroup;

    // Create separate groups for layers
    const layers: Record<string, THREE.Group> = {
      buildings: new THREE.Group(),
      surface: new THREE.Group(),
      vegetation: new THREE.Group(),
      infrastructure: new THREE.Group(),
      barriers: new THREE.Group(),
      topography: new THREE.Group()
    };
    layerGroupsRef.current = layers;

    // Add all layers to main group
    Object.values(layers).forEach(group => meshGroup.add(group));

    let totalMeshes = 0;
    let totalVertices = 0;

    // Define geometries for different node types
    const geometries: Record<string, THREE.BufferGeometry> = {
      tree_trunk: new THREE.CylinderGeometry(0.15, 0.2, 1, 5),
      tree_foliage: new THREE.IcosahedronGeometry(1, 0),
      shrubbery: new THREE.IcosahedronGeometry(1, 0),
      utilityPole: new THREE.CylinderGeometry(0.1, 0.1, 8, 8),
      bench: new THREE.BoxGeometry(2, 1, 1),
      default: new THREE.BoxGeometry(1, 1, 1)
    };

    // Adjust pivot points to bottom
    Object.values(geometries).forEach(geo => {
      // Check if already translated (hacky check but safe for this local scope)
      if (!geo.userData.translated) {
        geo.computeBoundingBox();
        const height = geo.boundingBox!.max.y - geo.boundingBox!.min.y;
        geo.translate(0, height / 2, 0);
        geo.userData.translated = true;
      }
    });

    const instances: Record<string, Array<{ position: THREE.Vector3, scale: THREE.Vector3, color: string }>> = {
      tree_trunk: [],
      tree_foliage: [],
      shrubbery: [],
      utilityPole: [],
      bench: [],
      default: []
    };

    geometryData.geometry.forEach((geomData) => {
      const { type, geometryType } = geomData;

      if (geometryType === 'meshes' && geomData.meshes) {
        geomData.meshes.forEach((mesh) => {
          if (!mesh.vertices || mesh.vertices.length === 0) return;

          const vertices = new Float32Array(mesh.vertices);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
          geometry.computeVertexNormals();


          let color = COLORS.buildings;
          let targetLayer = layers.infrastructure; // default fallback

          if (type === 'buildings') {
            color = COLORS.buildings;
            targetLayer = layers.buildings;
          } else if (type === 'surface') {
            const surfaceType = mesh.descriptor?.pathType || mesh.descriptor?.type || 'default';
            color = COLORS.surface[surfaceType as keyof typeof COLORS.surface] || COLORS.surface.default;
            targetLayer = layers.surface;

            // Store subtype for filtering later
            // We use 'subtype' in userData to match the keys in our state
            // Normalize some keys if needed
            let normalizedType = surfaceType;
            if (['pavement', 'footway'].includes(surfaceType)) normalizedType = 'footway';
            if (['roadway', 'roadwayIntersection', 'roadwayArea', 'asphalt'].includes(surfaceType)) normalizedType = 'roadway';
            // Actually let's keep exact mapping from the COLORS object keys for simplicity

          } else if (type === 'infrastructure') {
            const infraType = mesh.descriptor?.type || 'default';
            color = COLORS.infrastructure[infraType as keyof typeof COLORS.infrastructure] || COLORS.infrastructure.default;
            targetLayer = layers.infrastructure;
          } else if (type === 'barriers') {
            color = COLORS.barriers;
            targetLayer = layers.barriers;
          } else if (type === 'topography') {
            color = COLORS.topography;
            targetLayer = layers.topography;
          }

          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color),
            flatShading: false,
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.8
          });

          const meshObject = new THREE.Mesh(geometry, material);
          meshObject.castShadow = true;
          meshObject.receiveShadow = true;

          // Store metadata
          const surfaceType = mesh.descriptor?.pathType || mesh.descriptor?.type || 'default';
          meshObject.userData = {
            type,
            subtype: surfaceType,
            descriptor: mesh.descriptor
          };

          targetLayer.add(meshObject);

          // Add Edges for Buildings
          if (type === 'buildings') {
            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(
              edges,
              new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
            );
            meshObject.add(line);
          }

          totalMeshes++;
          totalVertices += vertices.length / 3;
        });
      }

      if (geometryType === 'nodes' && geomData.nodes) {
        geomData.nodes.forEach((node) => {
          const x = node.x || 0;
          const y = node.y || 0;
          const z = node.z || 0;
          const scale = node.scale || 1;
          // Normalize node type: Check instanceType first, then type, then default
          const rawType = node.instanceType || node.type || 'default';
          const nodeType = rawType.toLowerCase().trim();

          // Known non-tree types that have their own specific rendering or should be ignored if we had them
          const knownNonTreeTypes = ['shrubbery', 'utilitypole', 'bench', 'hydrant', 'rock', 'illustration', 'adcolumn', 'ac_unit'];

          // AGGRESSIVE FALLBACK: 
          // If it is explicitly a tree OR if it is NOT one of the known non-tree types, render it as a TREE.
          // This ensures that "default" (grey cubes) and other unknown types become trees.
          const isTree = nodeType.includes('tree') || !knownNonTreeTypes.includes(nodeType);

          if (isTree) {
            // Special handling for tree: Trunk + Foliage
            const treeScale = Math.max(scale, 1);

            // Trunk: Brown, thinner, cylinder
            // Increased size by 25% from previous small size
            instances['tree_trunk'].push({
              position: new THREE.Vector3(x, y, z),
              scale: new THREE.Vector3(treeScale * 0.0625, treeScale * 0.125, treeScale * 0.0625),
              color: '#5D4037' // Wood
            });

            // Foliage: Green, sphere on top (Icosahedron for low poly look)
            // Position foliage higher up on the trunk
            // Increased size by 25%
            instances['tree_foliage'].push({
              position: new THREE.Vector3(x, y + (treeScale * 0.156), z),
              scale: new THREE.Vector3(treeScale * 0.156, treeScale * 0.156, treeScale * 0.156),
              color: COLORS.infrastructure.tree
            });

          } else {
            // It is a known non-tree type (shrubbery, bench, utilityPole)
            let category = 'default';

            if (['shrubbery', 'utilitypole', 'bench'].includes(nodeType)) {
              if (nodeType === 'utilitypole') category = 'utilityPole';
              else category = nodeType;
            } else {
              category = 'default';
            }

            // Fallback for color lookup using the normalized type or original type
            const infraColor = COLORS.infrastructure[nodeType as keyof typeof COLORS.infrastructure] ||
              COLORS.infrastructure[rawType as keyof typeof COLORS.infrastructure] ||
              COLORS.infrastructure.default;

            const finalScale = Math.max(scale, 1) * 0.5;

            instances[category].push({
              position: new THREE.Vector3(x, y, z),
              scale: new THREE.Vector3(finalScale, finalScale, finalScale),
              color: infraColor
            });
          }
        });
      }
    });

    // Create InstancedMeshes
    const dummy = new THREE.Object3D();
    const whiteColor = new THREE.Color();

    Object.entries(instances).forEach(([category, items]) => {
      if (items.length === 0) return;

      const geometry = geometries[category] || geometries['default'];
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Base color white, multiplied by instance color
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1
      });

      const instancedMesh = new THREE.InstancedMesh(geometry, material, items.length);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      items.forEach((item, index) => {
        dummy.position.copy(item.position);
        dummy.scale.copy(item.scale);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0); // Random rotation
        dummy.updateMatrix();

        instancedMesh.setMatrixAt(index, dummy.matrix);
        instancedMesh.setColorAt(index, whiteColor.set(item.color));
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

      // Assign to correct layer group
      let targetLayer = layers.infrastructure;
      if (['tree_trunk', 'tree_foliage', 'shrubbery'].includes(category)) {
        targetLayer = layers.vegetation;
      } else {
        targetLayer = layers.infrastructure;
      }
      targetLayer.add(instancedMesh);

      totalMeshes++; // Count instances as meshes for stats 
      totalVertices += (geometry.attributes.position.count * items.length);
    });

    scene.add(meshGroup);
    setStats({ meshCount: totalMeshes, vertexCount: totalVertices });

    // Center and fit camera to model
    const box = new THREE.Box3().setFromObject(meshGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Add some padding

    camera.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.8, center.z + cameraZ * 0.5);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Apply initial visibility
    Object.entries(layerVisibility).forEach(([key, visible]) => {
      const group = layerGroupsRef.current[key];
      if (group) {
        if (key === 'surface' && typeof visible === 'object') {
          // Handle Surface Sublayers
          group.visible = visible._group;
          // Toggle individual children based on their userData type
          group.children.forEach(child => {
            const type = child.userData.subtype || 'default';
            const isSubVisible = (visible as any)[type] !== undefined ? (visible as any)[type] : true;
            child.visible = isSubVisible;
          });
        } else {
          // Standard Boolean Toggle
          group.visible = visible as boolean;
        }
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      controls.dispose();

      // Dispose geometries and materials
      meshGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [isOpen, geometryData]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const handleReset = () => {
    if (cameraRef.current && controlsRef.current && meshGroupRef.current) {
      const box = new THREE.Box3().setFromObject(meshGroupRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;

      cameraRef.current.position.set(center.x + cameraZ * 0.5, center.y + cameraZ * 0.8, center.z + cameraZ * 0.5);
      cameraRef.current.lookAt(center);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-7xl h-[90vh] rounded-[40px] shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 relative">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
              <Eye className="w-6 h-6 text-blue-500" />
              Model Preview
            </h2>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="flex bg-slate-900/50 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('3d')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === '3d'
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <Box className="w-3.5 h-3.5" />
                3D View
              </button>
              <button
                onClick={() => setActiveTab('render')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'render'
                  ? 'bg-purple-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
                  }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Render
              </button>
            </div>

            {activeTab === 'render' && (
              <button
                onClick={handleOpenPromptEditor}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-bold transition-all border border-white/10 animate-in fade-in zoom-in duration-200"
                title="Edit Rendering Prompt"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Prompt
              </button>
            )}
          </div>

          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden">

          {/* 3D Viewport */}
          {(!geometryData && isLoading) && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-400 font-mono text-sm uppercase tracking-widest animate-pulse">Loading Geometry...</p>
            </div>
          )}
          <div className={`absolute inset-0 ${activeTab === '3d' ? 'visible' : 'invisible'}`} ref={containerRef}>
            {/* 3D Canvas is appended here by existing useEffect */}

            {/* Layer Control Panel */}
            <div className={`absolute left-6 top-6 bottom-6 items-start transition-all duration-300 z-10 flex gap-2 pointer-events-none ${showLayers ? 'translate-x-0' : '-translate-x-[calc(100%-40px)]'}`}>
              <div className={`bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl transition-all pointer-events-auto flex flex-col ${showLayers ? 'w-64 h-full' : 'w-0 h-0 p-0 opacity-0 overflow-hidden'}`}>
                <div className="flex items-center gap-2 mb-2 text-slate-400 px-4 pt-4 pb-3 border-b border-white/5 shrink-0">
                  <Layers className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Scene Layers</span>
                </div>
                <div className="space-y-2 overflow-y-auto px-4 flex-1 min-h-0">
                  {[
                    { id: 'buildings', label: 'Buildings', hasSublayers: false },
                    { id: 'surface', label: 'Surface & Roads', hasSublayers: true },
                    { id: 'vegetation', label: 'Vegetation', hasSublayers: false },
                    { id: 'infrastructure', label: 'Infrastructure', hasSublayers: false },
                    { id: 'barriers', label: 'Barriers', hasSublayers: false },
                    { id: 'topography', label: 'Topography', hasSublayers: false }
                  ].map(layer => {
                    const isLayerVisible = layer.id === 'surface'
                      ? (layerVisibility.surface as any)._group
                      : (layerVisibility as any)[layer.id];

                    return (
                      <div key={layer.id} className="flex flex-col gap-1">
                        <div className={`w-full flex items-center justify-between p-2 rounded-lg transition-all ${isLayerVisible ? 'bg-blue-600/20 text-blue-200' : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                          <div className="flex items-center gap-2 flex-1">
                            {layer.hasSublayers && (
                              <button
                                onClick={() => setExpandedLayers(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                                className="p-1 hover:bg-white/10 rounded-full transition-colors"
                              >
                                {expandedLayers[layer.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            )}
                            <span className="text-xs font-bold cursor-pointer" onClick={() => layer.hasSublayers && setExpandedLayers(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}>
                              {layer.label}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              if (layer.id === 'surface') {
                                setLayerVisibility(prev => ({
                                  ...prev,
                                  surface: { ...prev.surface, _group: !prev.surface._group }
                                }));
                              } else {
                                setLayerVisibility(prev => ({ ...prev, [layer.id]: !(prev as any)[layer.id] }));
                              }
                            }}
                            className="p-1 hover:bg-white/10 rounded-full"
                          >
                            {isLayerVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Sublayers Render */}
                        {layer.hasSublayers && expandedLayers[layer.id] && layer.id === 'surface' && (
                          <div className="pl-8 flex flex-col gap-1 pb-2 animate-in slide-in-from-top-2 duration-200">
                            {Object.keys(COLORS.surface).filter(k => k !== 'default').concat(['default']).map(subKey => (
                              <button
                                key={subKey}
                                onClick={() => setLayerVisibility(prev => ({
                                  ...prev,
                                  surface: { ...prev.surface, [subKey]: !prev.surface[subKey as keyof typeof prev.surface] }
                                }))}
                                className={`flex items-center justify-between p-1.5 rounded-md text-xs transition-colors ${layerVisibility.surface[subKey as keyof typeof layerVisibility.surface] ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600'}`}
                              >
                                <span className="capitalize">{subKey.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <div
                                  className={`w-2 h-2 rounded-full border border-white/10`}
                                  style={{ backgroundColor: layerVisibility.surface[subKey as keyof typeof layerVisibility.surface] ? COLORS.surface[subKey as keyof typeof COLORS.surface] : '#334155' }}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Fixed Footer Controls (Sidebar Bottom) */}
                <div className="p-4 space-y-3 bg-slate-900/50 backdrop-blur-sm rounded-b-2xl border-t border-white/5 shrink-0 flex flex-col gap-3">

                  {/* Top Controls: Slider & Path (Always Visible) */}
                  <div className="space-y-3">

                    {/* Time Slider */}
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-white/5">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Time of Day
                        </span>
                        <span className="font-mono font-bold text-white text-xs">
                          {Math.floor(timeOfDay).toString().padStart(2, '0')}:{(Math.floor((timeOfDay % 1) * 60)).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="20"
                        step="0.1"
                        value={timeOfDay}
                        onChange={(e) => setTimeOfDay(parseFloat(e.target.value))}
                        className={`w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 transition-all mb-2 ${isSunStudyEnabled ? '[&::-webkit-slider-thumb]:bg-amber-500' : isClimateEnabled ? '[&::-webkit-slider-thumb]:bg-sky-500' : '[&::-webkit-slider-thumb]:bg-slate-400'}`}
                      />
                      <div className="flex justify-between text-[8px] text-slate-600 font-mono px-0.5">
                        <span>06:00</span>
                        <span>13:00</span>
                        <span>20:00</span>
                      </div>
                    </div>

                    {/* Sun Path Toggle */}
                    <button
                      onClick={() => setShowSolarPath(!showSolarPath)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${showSolarPath ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-slate-950/50 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest">Visualize Path</span>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${showSolarPath ? 'bg-amber-500' : 'bg-slate-700'}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showSolarPath ? 'left-[18px]' : 'left-0.5'}`} />
                      </div>
                    </button>
                  </div>

                  {/* 4-Button Grid: Default Shadow, Map, Sun, Climate */}
                  <div className="grid grid-cols-4 gap-2">
                    {/* 1. Default Shadows */}
                    <button
                      onClick={() => setShowDefaultShadows(!showDefaultShadows)}
                      disabled={isSunStudyEnabled}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${showDefaultShadows && !isSunStudyEnabled ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-800/50 border-white/5 text-slate-500 hover:bg-slate-800 hover:text-slate-300'} ${isSunStudyEnabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                      title="Default Shadows"
                    >
                      <Box className="w-4 h-4 mb-1" />
                      <span className="text-[8px] font-bold uppercase tracking-wider">Shad</span>
                    </button>

                    {/* 2. Map Underlay */}
                    <button
                      onClick={() => setShowMapUnderlay(!showMapUnderlay)}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${showMapUnderlay ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                      title="Map"
                    >
                      <ImageIcon className={`w-4 h-4 mb-1 ${showMapUnderlay ? 'text-indigo-400' : ''}`} />
                      <span className="text-[8px] font-bold uppercase tracking-wider">Map</span>
                    </button>

                    {/* 3. Sun Study */}
                    <button
                      onClick={() => {
                        setIsSunStudyEnabled(!isSunStudyEnabled);
                        if (isSunStudyEnabled) setIsClimateEnabled(false);
                      }}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${isSunStudyEnabled ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                      title="Sun Study"
                    >
                      <Sun className={`w-4 h-4 mb-1 ${isSunStudyEnabled ? 'text-amber-400' : ''}`} />
                      <span className="text-[8px] font-bold uppercase tracking-wider">Sun</span>
                    </button>

                    {/* 4. Climate */}
                    <button
                      onClick={() => setIsClimateEnabled(!isClimateEnabled)}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${isClimateEnabled ? 'bg-sky-500/20 border-sky-500/50 text-sky-300' : 'bg-slate-800/50 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                      title="Climate"
                    >
                      <Wind className={`w-4 h-4 mb-1 ${isClimateEnabled ? 'text-sky-400' : ''}`} />
                      <span className="text-[8px] font-bold uppercase tracking-wider">Clim</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Toggle Button */}
              <button
                onClick={() => setShowLayers(!showLayers)}
                className="h-10 w-10 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all pointer-events-auto shadow-lg"
              >
                {showLayers ? <ChevronLeft className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
              </button>
            </div>

            {/* Overlay Controls for 3D View - Reset View Only */}
            <div className="absolute bottom-6 right-6 flex gap-3 pointer-events-none">
              <button
                onClick={() => controlsRef.current?.reset()}
                className="bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white hover:bg-white/10 transition-all pointer-events-auto"
                title="Reset View"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Render Viewport */}
          {activeTab === 'render' && (
            <div className="absolute inset-0 flex items-center justify-center p-8 bg-slate-950">

              {/* Prompt Editor Overlay */}
              {showPromptEditor && (
                <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
                  <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Edit2 className="w-4 h-4 text-purple-400" />
                        Edit Render Prompt
                      </h3>
                      <button onClick={() => setShowPromptEditor(false)} className="text-slate-500 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <textarea
                      value={tempPrompt}
                      onChange={(e) => setTempPrompt(e.target.value)}
                      className="w-full h-32 bg-slate-800 border border-white/10 rounded-xl p-4 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      placeholder="Enter description..."
                    />

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowPromptEditor(false)}
                        className="px-4 py-2 hover:bg-white/5 text-slate-400 rounded-lg text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePrompt}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold flex items-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Save Prompt
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isRendering ? (
                <div className="relative w-full h-full flex items-center justify-center rounded-2xl overflow-hidden border border-white/10">
                  {/* Immediate Preview Background */}
                  {originalImageUrl && (
                    <img
                      src={originalImageUrl}
                      className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm brightness-50"
                      alt="Processing Preview"
                    />
                  )}

                  <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 relative z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
                      <Loader2 className="w-12 h-12 text-purple-500 animate-spin relative z-10" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-white font-bold text-lg">Rendering Scene...</h3>
                      <p className="text-slate-400 text-sm">Powered by Google Gemini</p>
                      {locationName && <p className="text-slate-500 text-xs mt-1">Context: {locationName}</p>}
                    </div>
                  </div>
                </div>
              ) : renderError ? (
                <div className="text-center max-w-md p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <h3 className="text-red-400 font-bold mb-2">Rendering Failed</h3>
                  <p className="text-slate-300 text-sm">{renderError}</p>
                  <button
                    onClick={handleRender}
                    className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : renderedImageUrl && originalImageUrl ? (
                <div
                  className="relative w-full h-full rounded-lg shadow-2xl border border-white/10 overflow-hidden cursor-ew-resize select-none"
                  ref={sliderRef}
                  onMouseMove={handleSliderMove}
                  onTouchMove={handleSliderMove}
                >
                  {/* Original Image (Before) */}
                  <img
                    src={originalImageUrl}
                    alt="Original View"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider pointer-events-none">
                    Original
                  </div>

                  {/* Rendered Image (After) - Clipped */}
                  <div
                    className="absolute inset-0 w-full h-full overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  >
                    <img
                      src={renderedImageUrl}
                      alt="Gemini Render"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-purple-600/80 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider pointer-events-none">
                      Gemini Render
                    </div>
                  </div>

                  {/* Slider Handle */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
                      <div className="flex gap-0.5">
                        <div className="w-0.5 h-3 bg-slate-400"></div>
                        <div className="w-0.5 h-3 bg-slate-400"></div>
                      </div>
                    </div>
                  </div>

                  {/* Download Action */}
                  <div className="absolute bottom-8 right-8 z-30">
                    <a
                      href={renderedImageUrl}
                      download="gemini_render.png"
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm transition-colors shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="w-4 h-4" />
                      Save Render
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No render generated yet.</p>
                  <button
                    onClick={handleRender}
                    className="mt-4 text-purple-400 hover:text-purple-300 font-bold text-sm"
                  >
                    Start Render from 3D View
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-[88px] px-6 border-t border-white/5 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center shrink-0">
          <div className="flex flex-col gap-1 w-[200px]">


            {/* Stats Display - Always Visible on Left */}
            {activeTab === '3d' && (
              <div className="text-[10px] text-slate-400 font-mono flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></div>
                  <span>{stats.meshCount.toLocaleString()} meshes</span>
                </div>
                <div className="pl-3.5">
                  {stats.vertexCount.toLocaleString()} vertices
                </div>
              </div>
            )}
          </div>

          {/* Center: Climate Information (Empty space filled when active) */}
          <div className="flex-1 flex justify-center">
            {isClimateEnabled && climateData && (
              (() => {
                const hourIndex = Math.round(timeOfDay) % 24;
                const currentData = climateData.hourly[hourIndex] || climateData.current;
                return (
                  <div className="flex items-center gap-6 animate-in fade-in zoom-in duration-300 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 shadow-lg">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-amber-500" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Temp</span>
                        <span className="text-sm font-black text-white font-mono leading-none">{currentData.temperature}°C</span>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-sky-400" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Wind</span>
                        <span className="text-sm font-black text-white font-mono leading-none">{currentData.windSpeed} <span className="text-[9px] text-slate-500">km/h</span></span>
                      </div>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-emerald-500" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Dir</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white font-mono leading-none">{currentData.windDirection}°</span>
                          <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center border border-white/10" style={{ transform: `rotate(${currentData.windDirection}deg)` }}>
                            <div className="w-0.5 h-2 bg-emerald-400 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Model Choice & Render - Moved to Footer, only show in 3D tab or Render tab if needed */}
            {nanoBananaApiKey && (
              <div className="flex shadow-lg rounded-xl">
                <div className="relative group">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as GeminiModel)}
                    className="appearance-none bg-slate-900/80 backdrop-blur-md pl-4 pr-8 py-3 rounded-l-xl border border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                    title="Select Rendering Model"
                  >
                    <option value="gemini-3-pro-image-preview" className="bg-slate-900 text-white">Gemini 3 Pro</option>
                    <option value="gemini-2.5-flash-image" className="bg-slate-900 text-white">Gemini 2.5 Flash</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Quality Selector - Only for Gemini 3 Pro */}
                {selectedModel === 'gemini-3-pro-image-preview' && (
                  <div className="relative group border-y border-l border-white/10">
                    <select
                      value={renderQuality}
                      onChange={(e) => setRenderQuality(e.target.value as any)}
                      className="appearance-none bg-slate-900/80 backdrop-blur-md pl-3 pr-8 py-3 outline-none text-white font-bold text-xs hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer h-full"
                      title="Select Render Quality"
                    >
                      <option value="1K" className="bg-slate-900 text-white">1K</option>
                      <option value="2K" className="bg-slate-900 text-white">2K</option>
                      <option value="4K" className="bg-slate-900 text-white">4K</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                )}

                <button
                  onClick={handleRender}
                  className="bg-purple-600/90 backdrop-blur-md px-4 py-3 rounded-r-xl border-l border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-purple-500 transition-all flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  Render
                </button>
              </div>
            )}

            <button
              onClick={onConfirmDownload}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-50 transition-colors shadow-lg shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Model
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelPreview;
