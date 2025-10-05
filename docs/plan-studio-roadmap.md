# Plan Studio Feature Roadmap

## Context

The `/planner` route currently provides a single-user sandbox with local persistence, quick-start templates, and a combined 2D/3D editor. The next milestone is to evolve it toward a Floorplanner-style tool with structured wall drafting, automatic room detection, multi-floor support, and richer camera controls.

This document captures the proposed implementation roadmap before any code changes.

## Progress (April 2024)

- ✅ Phase 0 foundations (floor/node/wall graph, persisted snapshot v2) are in place.
- ✅ Phase 1 snapped wall/room authoring, room detection, and inspector integration are live.
- ✅ Phase 2 enhancements landed: wall + room tooltips, inline room type cycling, wall metrical guards, and undo/redo history.
- ⏳ Phase 3 has add/duplicate/rename UI and per-floor persistence; delete action and multi-floor templates remain.
- ⏳ Phases 4–5 are planned but not started.

## Phase 0 – Foundations & Data Model

1. **Geometry Graph**
   - Introduce `Floor`, `Node`, and `Wall` models:
     - `Floor`: id, name, elevation, slab thickness, metadata, derived bounding box, version.
     - `Node`: id, floorId, x, y (meters), list of attached wall ids, flags for junction/corner.
     - `Wall`: id, floorId, startNodeId, endNodeId, thickness, height, baseElevation, material/finish metadata, optional openings.
   - Maintain a planar graph per floor. Walls store center-line geometry; nodes provide snapping points.

2. **Room Representation**
   - Derived `Room` objects (id, floorId, polygon, area, perimeter, centroid, adjacent wall ids, metadata such as type/style).
   - Rooms are read-only projections generated from the wall graph.

3. **Persistence Updates**
   - Extend `PersistedPlanSnapshot` versioning to include floors/nodes/walls/rooms arrays, plus migration strategy for existing saves.
   - Keep compatibility hooks for future backend sync (Yjs/doc store).

## Phase 1 – Snapped Wall & Room Authoring

1. **Draw Wall Tool (Snapped)**
   - Grid-aligned cursor (configurable cell size).
   - Start node is either new (snapped to grid) or existing (hover highlight) and same for end node.
   - On segment overlap or intersection, automatically create pivot node; split original wall into child segments, update adjacency lists.
   - Prevent duplicate colinear walls occupying identical nodes.

2. **Draw Room Tool (Rectilinear)**
   - Drag-to-place rectangle on grid; emits four wall segments with shared nodes.
   - Supports quick dimensions display during drag.

3. **Room Detection Pipeline**
   - After wall graph mutations, run planar loop detection (e.g., polygonisation of the graph offset by wall thickness).
   - Update or create `Room` objects; mark invalid floor sections until recomputation completes.
   - Cache area/perimeter and label best-fit centroid for tooltip placement.

4. **Selection & Metadata**
   - Clicking a wall highlights segment; inspector shows editable fields (length, thickness, height, material).
   - Clicking a room selects enclosed polygon; inspector allows room type/style assignment.

## Phase 2 – Dimensional Editing & Tooltips

1. **Wall Tooltips** (✅ implemented)
   - On wall selection, show inline tooltip near midpoint with numeric inputs for length, height, thickness.
   - Provide directional toggles based on wall orientation:
     - Horizontal walls: left / right / both.
     - Vertical walls: top / bottom / both.
   - Changing length adjusts node positions (respecting snap grid and shared pivots).

2. **Room Tooltips** (✅ implemented)
   - Display area/perimeter and room type; enable quick type cycling.
   - Future extension: style presets (materials, colour schemes).

3. **Validation & Constraints** (✅ initial pass complete)
   - Guard against collapsed walls (minimum length/thickness) and overlapping rooms (re-run detection).
   - Provide undo/redo stack integration for wall and room edits.

## Phase 3 – Floors & Templates

1. **Floor Management UI**
   - Floors sidebar/dropdown with add, duplicate, rename, delete actions.
   - Duplicate action clones nodes/walls/rooms, optionally adjusting elevation.

2. **Per-Floor Persistence**
   - Each floor maintains its own graph; global snapshot aggregates all floors.
   - Ensure 3D extrusions stack by elevation and slab thickness.

3. **Floor Templates**
   - Extend quick-starts to cover multi-floor scenarios (e.g., copy ground floor shell for upper storeys).

## Phase 4 – Viewport & Camera Controls

1. **2D View**
   - Mouse wheel = zoom (with configurable limits).
   - Middle button / space+drag = pan.
   - Home key to reset view to fit current floor.

2. **3D View**
   - Integrate orbit/dolly/pan from `@kouru/three`, expose UI buttons + shortcuts.
   - Support camera presets (isometric, top-down, custom saved views).
   - Sync floor visibility (hide inactive floors by default, add toggle for stacking).

3. **Viewport Toggle Enhancements**
   - Persist last-used mode per user snapshot.
   - Allow future side-by-side layout customisation.

## Phase 5 – Polishing & Extensions

1. **Openings & Components**
   - Reintroduce doors/windows as specialized openings linked to walls; reflect in room detection.

2. **Materials & Styles**
   - Hook inspector selections to three.js materials and 2D hatch patterns.

3. **Collaboration Readiness**
   - Plan Yjs document schema updates for shared walls/floors when multi-user editing is re-enabled.

4. **Freehand / Advanced Geometry (Future)**
   - Track requirement but deferred until rectilinear workflow completes.

## Next Steps

1. Close out Phase 3 floor management (delete action, elevation tweaks) and add multi-floor quick-start templates.
2. Begin Phase 4 viewport work: camera presets polish, floor visibility controls, and Home-to-fit shortcut.
3. Track material/style bindings and openings reintroduction as part of Phase 5 once the rectilinear workflow is stable.

Updates to this file should accompany roadmap progress to keep stakeholders aligned.
