# Research: Urban Analysis Plugins
This document summarizes findings on plugins and tools available for site analysis in urban planning and architecture, as requested.

## 1. Topography & Context
These tools help generate site context, including 3D buildings, roads, and terrain.

*   **CadMapper**:
    *   **Function**: Generates 3D files (CAD, SketchUp, Rhino) from OpenStreetMap data. Includes topography, buildings, and roads.
    *   **Output**: Clean 3D geometry organized by layers.
    *   **Relevance**: Great for quick site context.

*   **PlaceMaker (SketchUp)**:
    *   **Function**: Imports high-resolution satellite imagery, 3D buildings, trees, and roads.
    *   **Output**: Fully textured 3D models.

*   **Modelur (SketchUp)**:
    *   **Function**: Parametric urban design tool. Helps calculate GFA, FAR, and other urban KPIs in real-time.
    *   **Output**: Excel reports and 3D massing models.

## 2. Environmental Analysis
These plugins analyze sun, wind, and energy performance.

*   **Ladybug Tools (Rhino/Grasshopper, Web)**:
    *   **Function**: Industry standard for environmental analysis.
        *   **Ladybug**: Sun path, shadow studies, radiation analysis.
        *   **Butterfly**: CFD (Wind) analysis.
        *   **Honeybee**: Energy modeling.
    *   **Output**: Visual heatmaps, radiation charts, wind rose diagrams, and CSV data.

*   **Curio (formerly SunHours)**:
    *   **Function**: SketchUp plugin for visualizing sunlight hours on surfaces.
    *   **Output**: Colored meshes indicating sunlight exposure.

*   **ClimateStudio**:
    *   **Function**: Fast and accurate lighting and energy simulation.
    *   **Output**: Daylight autonomy maps, glare analysis, and energy use intensity reports.

## 3. Urban Analytics & Mobility
Tools for analyzing movement and accessibility.

*   **Space Syntax (DepthmapX)**:
    *   **Function**: Analyzes spatial networks to predict pedestrian and vehicular movement.
    *   **Output**: Integration and connectivity maps (heatmaps).

*   **PedSim**:
    *   **Function**: Crowd simulation and pedestrian movement analysis.
    *   **Output**: Flow animated paths and density maps.

*   **Urban Network Analysis (UNA) Toolbox**:
    *   **Function**: ArcGIS/Rhino plugin for analyzing spatial accessibility and network centrality.
    *   **Output**: Reach, gravity, and betweenness maps.

## 4. Web-Based & GIS Integration
*   **QGIS / ArcGIS**:
    *   **Function**: Heavy-duty GIS analysis (zoning, land use, demographics).
    *   **Output**: Comprehensive 2D maps and datasets.

*   **Mapbox GL JS / Deck.gl**:
    *   **Function**: Web libraries for visualizing large urban datasets (e.g., traffic, 3D buildings).
    *   **Output**: Interactive web maps.
