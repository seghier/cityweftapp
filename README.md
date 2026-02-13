# Cityweft App with 3D Preview

An enhanced version of the Cityweft application that allows you to **preview 3D models** in Three.js before downloading them.

## 🎯 Key Features

### New Preview Functionality
- **📦 Preview Before Download**: View your 3D model in an interactive Three.js viewer before committing to download
- **🎨 Real-time Geometry Rendering**: All geometry types (buildings, surface, infrastructure, barriers, topography) are rendered with accurate colors
- **🎮 Interactive Controls**: Orbit, pan, and zoom the camera to inspect your model from any angle
- **📊 Model Statistics**: See mesh count and vertex count at a glance
- **✅ Confirmation Flow**: Preview → Adjust settings if needed → Confirm & Download

## 🏗️ Architecture

### File Structure
```
updated_app/
├── App.tsx                          # Main app with preview modal integration
├── components/
│   ├── ControlPanel.tsx             # Updated with "Preview Model" button
│   ├── MapViewer.tsx                # Existing map selection component
│   └── ModelPreview.tsx             # NEW: Three.js preview modal
├── services/
│   └── api.ts                       # Updated with fetchGeometryJson()
├── types.ts                         # TypeScript definitions
├── package.json                     # Dependencies (includes Three.js)
└── README.md                        # This file
```

### Data Flow

```
1. User draws polygon on map
2. User clicks "Preview Model"
   ↓
3. App calls fetchGeometryJson()
   ↓
4. API returns JSON geometry:
   {
     "origin": [lat, lon],
     "geometry": [{
       "type": "buildings",
       "geometryType": "meshes",
       "meshes": [{
         "vertices": [x,y,z,...],
         "descriptor": {...}
       }]
     }]
   }
   ↓
5. ModelPreview component renders in Three.js
   ↓
6. User confirms → Downloads actual file
```

## 🚀 Installation

```bash
cd updated_app
npm install
npm run dev
```

## 🎨 Key Components

### 1. ModelPreview Component (`components/ModelPreview.tsx`)

The star of the show! This component:
- Creates a Three.js scene with proper lighting
- Parses JSON geometry from the API
- Renders meshes with appropriate colors based on type
- Provides orbit controls for camera movement
- Shows mesh/vertex statistics

**Color Scheme:**
- **Buildings**: `#94a3b8` (slate)
- **Surface**:
  - Asphalt: `#333333`
  - Grass: `#7CFC00`
  - Water: `#ADD8E6`
  - Roads: `#808080`
- **Infrastructure**:
  - Trees: `#228B22`
  - Benches: `#A0522D`
  - Utility poles: `#696969`
- **Barriers**: `#8B4513` (brown)
- **Topography**: `#654321` (earth)

### 2. Updated API Service (`services/api.ts`)

New function: `fetchGeometryJson()`
- Fetches **JSON geometry** from `/v1/context` endpoint
- Does NOT trigger file export
- Returns raw geometry data for preview
- Faster than full download (no file conversion)

### 3. Updated ControlPanel (`components/ControlPanel.tsx`)

New UI elements:
- **"Preview Model"** button (with Eye icon)
- Placed above the main "Extract Site" download button
- Only enabled when a valid polygon is selected

### 4. Updated App (`App.tsx`)

New state & handlers:
```typescript
const [showPreview, setShowPreview] = useState(false);
const [previewData, setPreviewData] = useState<GeometryResponse | null>(null);
const [isLoadingPreview, setIsLoadingPreview] = useState(false);

const handlePreview = async () => { ... }
const handleDownloadFromPreview = async () => { ... }
```

## 📋 Usage Flow

### For End Users:

1. **Open the app** and search for a location
2. **Draw a polygon** on the map (max 5 km²)
3. **Configure settings** in the control panel:
   - Select geometry layers
   - Choose coordinate system
   - Set export format
4. **Click "Preview Model"** 
5. **Inspect the 3D model**:
   - Left-click and drag to rotate
   - Right-click and drag to pan
   - Scroll to zoom
   - Click reset button to return to default view
6. **Confirm & Download** or close and adjust settings
7. **Download the file** in your chosen format

### Integration with SketchUp Extension

The SketchUp extension uses the same JSON format. You can:

1. **Export from SketchUp** → JSON geometry
2. **Preview in web app** → Verify before import
3. **Download** → Import into other tools

## 🔧 API Integration

### Preview Endpoint (JSON)
```typescript
POST /v1/context
Headers: {
  Authorization: Bearer YOUR_API_KEY
}
Body: {
  polygon: [[lat, lon], ...],
  settings: {
    geometry: ['buildings', 'surface', ...],
    topographyModel: false,
    ...
  }
}

Response: {
  origin: [lat, lon],
  geometry: [...]
}
```

### Download Endpoint (File Export)
```typescript
POST /v1/context
Body: {
  polygon: [...],
  settings: {...},
  export: {
    format: 'skp',
    version: null
  },
  requestId: '...',
  timestamp: 123456789
}

Response: {
  downloadUrl: 'https://...'
}
```

## 🎓 Technical Details

### Three.js Setup

The ModelPreview component:
1. Creates a scene with `THREE.Scene()`
2. Adds perspective camera with FOV 60°
3. Sets up ambient + directional lighting
4. Uses `OrbitControls` for camera manipulation
5. Renders geometry with `THREE.BufferGeometry`
6. Applies materials with `THREE.MeshStandardMaterial`

### Performance Optimizations

- Vertex normals computed for proper lighting
- Shadow mapping enabled for realistic rendering
- Pixel ratio capped at 2x for performance
- Geometry/materials disposed on cleanup
- Animation frame request cancelled on unmount

### Coordinate System Transform

Cityweft uses a Y-up coordinate system, while Three.js uses Z-up by default. The component handles this transform:

```typescript
// Cityweft: [x, y, z]
// Three.js: position.set(x, z, -y)
```

## 🌟 Benefits Over Direct Download

1. **Faster Iteration**: Preview without waiting for file conversion
2. **Visual Verification**: Ensure you're getting the right data
3. **Settings Adjustment**: Fine-tune before committing to download
4. **Bandwidth Saving**: No need to download large files multiple times
5. **Cross-Platform**: Works in any browser, no CAD software needed

## 🔮 Future Enhancements

Potential additions:
- [ ] Measurement tools (distance, area)
- [ ] Layer visibility toggles
- [ ] Material/color customization
- [ ] Screenshot/export to PNG
- [ ] VR mode support
- [ ] Animation playback
- [ ] Comparison between different settings

## 📚 Documentation References

- [Three.js Docs](https://threejs.org/docs/)
- [Cityweft API Docs](https://cityweft.gitbook.io/docs/getting-started/three-quick-guide)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) (alternative if you want declarative approach)

## 🐛 Troubleshooting

### Preview not loading?
- Check browser console for errors
- Verify API key is configured
- Ensure polygon area is under 5 km²

### Poor performance?
- Reduce polygon size
- Disable unnecessary geometry layers
- Lower browser zoom level
- Try in Chrome/Edge (better WebGL support)

### Colors look wrong?
- Check geometry type in API response
- Verify descriptor.type field is set
- Inspect material assignment in ModelPreview.tsx

## 📄 License

For commercial use contact me
