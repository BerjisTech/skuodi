import { AsyncPipe, DatePipe, DecimalPipe, KeyValuePipe, NgClass, NgFor, NgIf } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  EffectRef,
  effect,
  inject,
  signal,
  HostListener,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, combineLatest, filter, map, of, switchMap } from 'rxjs';
import { CursorService } from '@kouru/collab';
import { createScene, resizeRenderer, animate, addGrid } from '@kouru/three';
import * as THREE from 'three';
import { FormsModule } from '@angular/forms';
import { ProjectsService } from '../../core/services/projects.service';
import { SpacesService } from '../../core/services/spaces.service';
import { SpaceMember } from '../../core/models';

type EditorElementType =
  | 'wall'
  | 'door'
  | 'window'
  | 'gutter'
  | 'stairs'
  | 'rail'
  | 'balcony'
  | 'pillar'
  | 'corridor'
  | 'custom';

type NumericProperty = 'width' | 'depth' | 'height' | 'thickness' | 'angle';

interface EditorElement {
  id: string;
  type: EditorElementType;
  name: string;
  position: { x: number; y: number };
  rotation: number; // degrees
  width: number; // meters (x axis)
  depth: number; // meters (y axis)
  height: number; // meters (z axis)
  thickness?: number; // optional structural thickness
  angle?: number; // for slants / spirals etc
  source: 'tool' | 'preset' | 'imported';
  assetRef?: string;
}

interface ToolDefinition {
  id: string;
  type: EditorElementType | 'select';
  label: string;
  description: string;
  icon?: string;
  defaults?: Partial<EditorElement>;
  editable: NumericProperty[];
}

interface ToolGroup {
  title: string;
  tools: ToolDefinition[];
}

interface ImportedAsset {
  id: string;
  fileName: string;
  size: number;
  createdAt: Date;
}

interface PresetAsset {
  id: string;
  name: string;
  type: EditorElementType;
  description: string;
  element: Partial<EditorElement>;
}

type ViewMode = 'plan' | 'scene' | 'split';

interface QuickStartFloorWallConfig {
  start: { x: number; y: number };
  end: { x: number; y: number };
  thickness?: number;
  height?: number;
}

interface QuickStartFloorConfig {
  name: string;
  elevation: number;
  slabThickness?: number;
  walls: QuickStartFloorWallConfig[];
}

interface QuickStartTemplate {
  id: string;
  name: string;
  description: string;
  elements?: Array<
    Partial<EditorElement> & {
      type: EditorElementType;
      position: { x: number; y: number };
    }
  >;
  floors?: QuickStartFloorConfig[];
}

type StoredImportedAsset = Omit<ImportedAsset, 'createdAt'> & { createdAt: string };

type WallOrientation = 'horizontal' | 'vertical';

interface PlanFloor {
  id: string;
  name: string;
  elevation: number;
  slabThickness: number;
  createdAt: number;
  updatedAt: number;
}

interface PlanNode {
  id: string;
  floorId: string;
  x: number;
  y: number;
  wallIds: string[];
}

interface PlanWall {
  id: string;
  floorId: string;
  startNodeId: string;
  endNodeId: string;
  thickness: number;
  height: number;
  baseElevation: number;
  material?: string;
  metadata?: Record<string, unknown>;
}

interface PlanRoom {
  id: string;
  floorId: string;
  nodeRing: string[];
  polygon: { x: number; y: number }[];
  area: number;
  perimeter: number;
  centroid: { x: number; y: number };
  roomType?: string;
  styleRef?: string;
}

interface FloorState {
  floor: PlanFloor;
  nodes: PlanNode[];
  walls: PlanWall[];
  rooms: PlanRoom[];
}

interface PlannerPersistencePayload {
  elements: EditorElement[];
  importedAssets: ImportedAsset[];
  lastElementId: number;
  lastAssetId: number;
  elementCounters: Partial<Record<EditorElementType, number>>;
  selectedToolId: string;
  selectedElementId: string | null;
  onboardingDismissed: boolean;
  floors: FloorState[];
  activeFloorId: string;
  viewMode: ViewMode;
}

interface StoredFloorState {
  floor: PlanFloor;
  nodes: PlanNode[];
  walls: PlanWall[];
  rooms: PlanRoom[];
}

interface PersistedPlanSnapshot {
  version: 2;
  legacyElements?: EditorElement[];
  legacyImportedAssets?: StoredImportedAsset[];
  elements: EditorElement[];
  importedAssets: StoredImportedAsset[];
  lastElementId: number;
  lastAssetId: number;
  elementCounters: Partial<Record<EditorElementType, number>>;
  selectedToolId: string;
  selectedElementId: string | null;
  onboardingDismissed: boolean;
  floors: StoredFloorState[];
  activeFloorId: string;
  viewMode?: ViewMode;
}

interface PlannerHistorySnapshot {
  floors: FloorState[];
  activeFloorId: string;
  selectedWallId: string | null;
  selectedRoomId: string | null;
}

@Component({
  standalone: true,
  selector: 'app-project-editor',
  imports: [AsyncPipe, NgIf, NgFor, NgClass, RouterLink, KeyValuePipe, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
})
export class EditorComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly projects = inject(ProjectsService);
  private readonly spaces = inject(SpacesService);
  private readonly cursors = inject(CursorService);
  private readonly mode: 'single' | 'collab' =
    this.route.snapshot.data?.['mode'] === 'single' ? 'single' : 'collab';

  private readonly pixelsPerMeter = 80;
  readonly isSingleUserMode = this.mode === 'single';
  readonly toolGroups: ToolGroup[] = this.isSingleUserMode
    ? this.buildSingleUserToolGroups()
    : this.buildCollaborativeToolGroups();

  private buildSingleUserToolGroups(): ToolGroup[] {
    return [
      {
        title: 'Drafting',
        tools: [
          {
            id: 'select',
            type: 'select',
            label: 'Select',
            description: 'Pick and move elements in the plan.',
            icon: '🖱️',
            editable: [],
          },
          {
            id: 'draw-room',
            type: 'custom',
            label: 'Draw Room',
            description: 'Drag a rectangle to create enclosing walls.',
            icon: '⬛',
            editable: [],
          },
          {
            id: 'draw-wall',
            type: 'custom',
            label: 'Draw Wall',
            description: 'Click and drag to place snapped wall segments.',
            icon: '▭',
            editable: [],
          },
        ],
      },
      {
        title: 'Structure',
        tools: [
          {
            id: 'balcony',
            type: 'balcony',
            label: 'Balcony',
            description: 'Cantilever or Juliet balcony massing.',
            icon: '🛋️',
            defaults: { width: 3.5, depth: 1.8, height: 1.1, thickness: 0.1 },
            editable: ['width', 'depth', 'height'],
          },
        ],
      },
      {
        title: 'Openings',
        tools: [
          {
            id: 'door',
            type: 'door',
            label: 'Door',
            description: 'Hinged door block with swing.',
            icon: '🚪',
            defaults: { width: 0.9, depth: 0.1, height: 2.1, thickness: 0.1, angle: 90 },
            editable: ['width', 'height', 'thickness', 'angle'],
          },
          {
            id: 'window',
            type: 'window',
            label: 'Window',
            description: 'Glazing opening with frame.',
            icon: '🪟',
            defaults: { width: 1.5, depth: 0.15, height: 1.4, thickness: 0.15 },
            editable: ['width', 'height', 'thickness'],
          },
        ],
      },
    ];
  }

  private buildCollaborativeToolGroups(): ToolGroup[] {
    return [
      {
        title: 'Modes',
        tools: [
          {
            id: 'select',
            type: 'select',
            label: 'Select',
            description: 'Pick and move elements in the plan.',
            icon: '🖱️',
            editable: [],
          },
        ],
      },
      {
        title: 'Structure',
        tools: [
          {
            id: 'wall',
            type: 'wall',
            label: 'Wall',
            description: 'Rectilinear wall segment.',
            icon: '🧱',
            defaults: { width: 4, depth: 0.25, height: 3.2, thickness: 0.25 },
            editable: ['width', 'height', 'thickness'],
          },
          {
            id: 'pillar',
            type: 'pillar',
            label: 'Pillar',
            description: 'Structural pillar or column.',
            icon: '🗼',
            defaults: { width: 0.45, depth: 0.45, height: 3.2 },
            editable: ['width', 'depth', 'height'],
          },
          {
            id: 'balcony',
            type: 'balcony',
            label: 'Balcony',
            description: 'Cantilever or Juliet balcony massing.',
            icon: '🪟',
            defaults: { width: 3.5, depth: 1.8, height: 1.1, thickness: 0.1 },
            editable: ['width', 'depth', 'height', 'angle'],
          },
        ],
      },
      {
        title: 'Access & Openings',
        tools: [
          {
            id: 'door',
            type: 'door',
            label: 'Door',
            description: 'Hinged door block with swing.',
            icon: '🚪',
            defaults: { width: 0.9, depth: 0.1, height: 2.1, thickness: 0.1, angle: 90 },
            editable: ['width', 'height', 'thickness', 'angle'],
          },
          {
            id: 'window',
            type: 'window',
            label: 'Window',
            description: 'Glazing opening with frame.',
            icon: '🪟',
            defaults: { width: 1.5, depth: 0.15, height: 1.4, thickness: 0.15 },
            editable: ['width', 'height', 'thickness'],
          },
          {
            id: 'stairs',
            type: 'stairs',
            label: 'Stairs',
            description: 'Straight run stair block.',
            icon: '🪜',
            defaults: { width: 1.2, depth: 3.6, height: 3.2, angle: 35 },
            editable: ['width', 'depth', 'height', 'angle'],
          },
          {
            id: 'rail',
            type: 'rail',
            label: 'Rail',
            description: 'Balustrade or guard rail run.',
            icon: '🛡️',
            defaults: { width: 2.4, depth: 0.12, height: 1.1 },
            editable: ['width', 'height'],
          },
        ],
      },
      {
        title: 'Exterior',
        tools: [
          {
            id: 'gutter',
            type: 'gutter',
            label: 'Gutter',
            description: 'Roof drainage run.',
            icon: '🌧️',
            defaults: { width: 3.5, depth: 0.18, height: 0.2, angle: 2 },
            editable: ['width', 'angle'],
          },
          {
            id: 'custom',
            type: 'custom',
            label: 'Custom Mass',
            description: 'Generic block for early studies.',
            icon: '✳️',
            defaults: { width: 1.5, depth: 1.5, height: 1.5, angle: 0 },
            editable: ['width', 'depth', 'height', 'angle'],
          },
        ],
      },
    ];
  }

  readonly predesignedAssets: PresetAsset[] = this.isSingleUserMode
    ? this.buildSingleUserPresetAssets()
    : this.buildCollaborativePresetAssets();

  private buildSingleUserPresetAssets(): PresetAsset[] {
    return [
      {
        id: 'starter-corridor',
        name: 'Linear Hallway',
        type: 'corridor',
        description: '2.5m wide circulation zone with gentle taper.',
        element: { type: 'corridor', name: 'Linear Hallway', width: 6, depth: 2.5, height: 0.2 },
      },
      {
        id: 'picture-window',
        name: 'Picture Window',
        type: 'window',
        description: 'Wide horizontal glazing for shared spaces.',
        element: { type: 'window', name: 'Picture Window', width: 3.6, depth: 0.18, height: 1.4, thickness: 0.16 },
      },
      {
        id: 'balcony-module',
        name: 'Standard Balcony',
        type: 'balcony',
        description: 'Prefabricated balcony with 1.2m projection.',
        element: { type: 'balcony', name: 'Standard Balcony', width: 3.2, depth: 1.2, height: 1.0 },
      },
    ];
  }

  private buildCollaborativePresetAssets(): PresetAsset[] {
    return [
      {
        id: 'spiral-stair',
        name: 'Spiral Stair',
        type: 'stairs',
        description: 'Compact galvanized spiral stair with 320° sweep.',
        element: { type: 'stairs', name: 'Spiral Stair', width: 2.2, depth: 2.2, height: 3.2, angle: 320 },
      },
      {
        id: 'panorama-window',
        name: 'Panorama Window',
        type: 'window',
        description: 'Three-panel floor to ceiling glazing unit.',
        element: { type: 'window', name: 'Panorama Window', width: 4.5, depth: 0.2, height: 2.6, thickness: 0.2 },
      },
      {
        id: 'cantilever-balcony',
        name: 'Cantilever Balcony',
        type: 'balcony',
        description: 'Steel framed balcony with glass guard.',
        element: { type: 'balcony', name: 'Cantilever Balcony', width: 4.2, depth: 2.1, height: 1.05, angle: 0 },
      },
      {
        id: 'steel-rail',
        name: 'Steel Rail',
        type: 'rail',
        description: 'Powder coated guard rail module.',
        element: { type: 'rail', name: 'Steel Rail', width: 3.2, depth: 0.12, height: 1.05 },
      },
    ];
  }

  private buildQuickStartTemplates(): QuickStartTemplate[] {
    return [
      {
        id: 'stacked-duplex',
        name: 'Stacked Duplex Shell',
        description: 'Two aligned floors with a shared footprint and stair core.',
        floors: [
          {
            name: 'Ground Floor',
            elevation: 0,
            slabThickness: 0.3,
            walls: [
              { start: { x: -4, y: -3 }, end: { x: 4, y: -3 } },
              { start: { x: 4, y: -3 }, end: { x: 4, y: 3 } },
              { start: { x: 4, y: 3 }, end: { x: -4, y: 3 } },
              { start: { x: -4, y: 3 }, end: { x: -4, y: -3 } },
              { start: { x: -1.75, y: -3 }, end: { x: -1.75, y: 3 } },
              { start: { x: -1.75, y: 1.5 }, end: { x: -4, y: 1.5 } },
            ],
          },
          {
            name: 'Upper Floor',
            elevation: 3.2,
            slabThickness: 0.3,
            walls: [
              { start: { x: -4, y: -3 }, end: { x: 4, y: -3 } },
              { start: { x: 4, y: -3 }, end: { x: 4, y: 3 } },
              { start: { x: 4, y: 3 }, end: { x: -4, y: 3 } },
              { start: { x: -4, y: 3 }, end: { x: -4, y: -3 } },
              { start: { x: -1.75, y: -3 }, end: { x: -1.75, y: 3 } },
              { start: { x: -1.75, y: 1.5 }, end: { x: -4, y: 1.5 } },
            ],
          },
        ],
        elements: [
          {
            type: 'stairs',
            position: { x: -2.6, y: 0 },
            width: 1.2,
            depth: 3.4,
            height: 3.2,
            angle: 32,
            name: 'Stair Core',
          },
          {
            type: 'door',
            position: { x: -4, y: 0 },
            rotation: 90,
            width: 1,
            height: 2.1,
            thickness: 0.1,
            angle: 85,
            name: 'Entry Door',
          },
        ],
      },
      {
        id: 'compact-studio',
        name: 'Compact Studio',
        description: '8×6m shell with entry corridor, balcony, and generous glazing.',
        elements: [
          {
            type: 'wall',
            name: 'North Wall',
            position: { x: 0, y: 3 },
            width: 8,
            depth: 0.25,
            height: 3,
            thickness: 0.25,
          },
          {
            type: 'wall',
            name: 'South Wall',
            position: { x: 0, y: -3 },
            width: 8,
            depth: 0.25,
            height: 3,
            thickness: 0.25,
          },
          {
            type: 'wall',
            name: 'East Wall',
            position: { x: 4, y: 0 },
            width: 6,
            depth: 0.25,
            height: 3,
            thickness: 0.25,
            rotation: 90,
          },
          {
            type: 'wall',
            name: 'West Wall',
            position: { x: -4, y: 0 },
            width: 6,
            depth: 0.25,
            height: 3,
            thickness: 0.25,
            rotation: 90,
          },
          {
            type: 'corridor',
            name: 'Entry Corridor',
            position: { x: -2.2, y: -1.8 },
            width: 2.6,
            depth: 2.8,
            height: 0.16,
          },
          {
            type: 'door',
            name: 'Front Door',
            position: { x: -4, y: -1.8 },
            rotation: 90,
            width: 1,
            height: 2.1,
            thickness: 0.1,
            angle: 85,
          },
          {
            type: 'window',
            name: 'Living Window',
            position: { x: 0, y: 3 },
            width: 3.8,
            depth: 0.2,
            height: 1.4,
            thickness: 0.18,
          },
          {
            type: 'balcony',
            name: 'Juliet Balcony',
            position: { x: 0, y: 3.8 },
            width: 3.5,
            depth: 1.4,
            height: 1.05,
            thickness: 0.12,
          },
        ],
      },
      {
        id: 'atrium-retreat',
        name: 'Atrium Retreat',
        description: 'L-shaped layout framing a central corridor and large patio window.',
        elements: [
          {
            type: 'wall',
            name: 'North Wing',
            position: { x: 2.5, y: 4 },
            width: 5,
            depth: 0.25,
            height: 3,
            thickness: 0.22,
          },
          {
            type: 'wall',
            name: 'West Spine',
            position: { x: -2.5, y: 0.5 },
            width: 9,
            depth: 0.25,
            height: 3,
            thickness: 0.22,
            rotation: 90,
          },
          {
            type: 'wall',
            name: 'South Wing',
            position: { x: 1, y: -3.5 },
            width: 6.5,
            depth: 0.25,
            height: 3,
            thickness: 0.22,
          },
          {
            type: 'corridor',
            name: 'Central Hall',
            position: { x: 0, y: 0.5 },
            width: 2.4,
            depth: 6.5,
            height: 0.14,
            rotation: 90,
          },
          {
            type: 'door',
            name: 'Atrium Entry',
            position: { x: -2.5, y: -2.2 },
            rotation: 90,
            width: 1.1,
            height: 2.1,
            thickness: 0.1,
            angle: 95,
          },
          {
            type: 'window',
            name: 'Atrium Glazing',
            position: { x: 2.5, y: 4 },
            width: 2.8,
            depth: 0.18,
            height: 2.2,
            thickness: 0.16,
          },
          {
            type: 'window',
            name: 'Garden Opening',
            position: { x: 1, y: -3.5 },
            width: 2.4,
            depth: 0.18,
            height: 1.8,
            thickness: 0.16,
          },
          {
            type: 'balcony',
            name: 'Garden Terrace',
            position: { x: 1, y: -4.4 },
            width: 4,
            depth: 1.6,
            height: 1,
            thickness: 0.12,
          },
        ],
      },
      {
        id: 'dual-axis',
        name: 'Dual Axis Loft',
        description: 'Offset walls forming two zones linked by a generous hallway.',
        elements: [
          {
            type: 'wall',
            name: 'Outer Wall A',
            position: { x: -3, y: 3.2 },
            width: 6,
            depth: 0.25,
            height: 3.2,
            thickness: 0.25,
          },
          {
            type: 'wall',
            name: 'Outer Wall B',
            position: { x: 3.2, y: -2 },
            width: 6.8,
            depth: 0.25,
            height: 3.2,
            thickness: 0.25,
            rotation: 90,
          },
          {
            type: 'wall',
            name: 'Outer Wall C',
            position: { x: -3, y: -3.2 },
            width: 6,
            depth: 0.25,
            height: 3.2,
            thickness: 0.25,
          },
          {
            type: 'corridor',
            name: 'Link Hall',
            position: { x: 0, y: 0 },
            width: 2.2,
            depth: 6.8,
            height: 0.16,
          },
          {
            type: 'door',
            name: 'Side Entry',
            position: { x: 3.2, y: 0.8 },
            width: 1,
            height: 2.1,
            thickness: 0.1,
            rotation: 90,
            angle: 80,
          },
          {
            type: 'window',
            name: 'Corner Window',
            position: { x: -3, y: 3.2 },
            width: 2.6,
            depth: 0.18,
            height: 1.5,
            thickness: 0.15,
          },
          {
            type: 'window',
            name: 'Reading Nook Window',
            position: { x: -3, y: -3.2 },
            width: 2,
            depth: 0.18,
            height: 1.2,
            thickness: 0.15,
          },
        ],
      },
    ];
  }

  private restoreLocalPlanSnapshot() {
    const snapshot = this.readLocalPlanSnapshot();
    if (!snapshot) {
      const defaultFloor = this.createFloorState('Ground Floor', 0);
      this.floorsState.set([defaultFloor]);
      this.activeFloorId.set(defaultFloor.floor.id);
      return { hasElements: false };
    }

    const elementsSource = snapshot.elements?.length
      ? snapshot.elements
      : snapshot.legacyElements ?? [];
    const assetsSource = snapshot.importedAssets?.length
      ? snapshot.importedAssets
      : snapshot.legacyImportedAssets ?? [];

    const elements = elementsSource
      .map((candidate) => this.sanitizeStoredElement(candidate))
      .filter((candidate): candidate is EditorElement => Boolean(candidate));
    const imported = assetsSource
      .map((candidate) => this.sanitizeImportedAsset(candidate))
      .filter((candidate): candidate is ImportedAsset => Boolean(candidate));

    this.elements.set(elements);
    this.importedAssets.set(imported);
    this.lastElementId = Number.isFinite(snapshot.lastElementId) ? snapshot.lastElementId : elements.length;
    this.lastAssetId = Number.isFinite(snapshot.lastAssetId) ? snapshot.lastAssetId : imported.length;
    this.elementCounters = this.sanitizeElementCounters(snapshot.elementCounters);

    if (snapshot.selectedToolId) {
      this.selectedToolId.set(snapshot.selectedToolId);
    }
    if (snapshot.selectedElementId && elements.some((el) => el.id === snapshot.selectedElementId)) {
      this.selectedElementId.set(snapshot.selectedElementId);
    } else {
      this.selectedElementId.set(null);
    }

    this.onboardingDismissed.set(Boolean(snapshot.onboardingDismissed));

    const floorStates = (snapshot.floors && snapshot.floors.length
      ? snapshot.floors
      : [this.createFloorState('Ground Floor', 0)])
      .map((stored) => this.sanitizeStoredFloor(stored));

    this.floorsState.set(floorStates);

    const floorId = snapshot.activeFloorId && floorStates.some((f) => f.floor.id === snapshot.activeFloorId)
      ? snapshot.activeFloorId
      : floorStates[0]?.floor.id ?? '';
    this.activeFloorId.set(floorId);

    this.reseedIdentifiersFromFloors(floorStates);
    this.resetHistoryStacks();

    if (snapshot.viewMode) {
      this.viewMode.set(snapshot.viewMode);
    }

    return { hasElements: elements.length > 0 || floorStates.some((state) => state.walls.length > 0) };
  }

  private readLocalPlanSnapshot(): PersistedPlanSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(this.localPlanStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<PersistedPlanSnapshot> & Record<string, unknown>;
      if (!parsed) {
        return null;
      }
      if (parsed.version === 2) {
        return {
          version: 2,
          elements: Array.isArray(parsed.elements) ? parsed.elements : [],
          importedAssets: Array.isArray(parsed.importedAssets) ? parsed.importedAssets : [],
          legacyElements: Array.isArray(parsed.legacyElements) ? parsed.legacyElements : undefined,
          legacyImportedAssets: Array.isArray(parsed.legacyImportedAssets) ? parsed.legacyImportedAssets : undefined,
          lastElementId: Number(parsed.lastElementId ?? 0),
          lastAssetId: Number(parsed.lastAssetId ?? 0),
          elementCounters: (parsed.elementCounters as Partial<Record<EditorElementType, number>>) ?? {},
          selectedToolId: typeof parsed.selectedToolId === 'string' ? parsed.selectedToolId : 'select',
          selectedElementId: typeof parsed.selectedElementId === 'string' ? parsed.selectedElementId : null,
          onboardingDismissed: Boolean(parsed.onboardingDismissed),
          floors: Array.isArray(parsed.floors) ? (parsed.floors as StoredFloorState[]) : [],
          activeFloorId: typeof parsed.activeFloorId === 'string' ? parsed.activeFloorId : '',
          viewMode: (parsed.viewMode as ViewMode | undefined) ?? undefined,
        };
      }

      // Legacy v1 snapshot migration
      if (!parsed.version || parsed.version === 1) {
        const legacyElements = Array.isArray(parsed.elements) ? (parsed.elements as EditorElement[]) : [];
        const legacyImported = Array.isArray(parsed.importedAssets)
          ? (parsed.importedAssets as StoredImportedAsset[])
          : [];
        return {
          version: 2,
          elements: legacyElements,
          importedAssets: legacyImported,
          legacyElements,
          legacyImportedAssets: legacyImported,
          lastElementId: Number(parsed.lastElementId ?? legacyElements.length ?? 0),
          lastAssetId: Number(parsed.lastAssetId ?? legacyImported.length ?? 0),
          elementCounters: (parsed.elementCounters as Partial<Record<EditorElementType, number>>) ?? {},
          selectedToolId: typeof parsed.selectedToolId === 'string' ? parsed.selectedToolId : 'select',
          selectedElementId: typeof parsed.selectedElementId === 'string' ? parsed.selectedElementId : null,
          onboardingDismissed: Boolean(parsed.onboardingDismissed),
          floors: [],
          activeFloorId: '',
          viewMode: undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private writeLocalPlanSnapshot(snapshot: PlannerPersistencePayload) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const payload: PersistedPlanSnapshot = {
        version: 2,
        elements: snapshot.elements.map((element) => ({
          ...element,
          position: { ...element.position },
        })),
        importedAssets: snapshot.importedAssets.map((asset) => ({
          ...asset,
          createdAt: asset.createdAt.toISOString(),
        })),
        legacyElements: undefined,
        legacyImportedAssets: undefined,
        lastElementId: snapshot.lastElementId,
        lastAssetId: snapshot.lastAssetId,
        elementCounters: { ...snapshot.elementCounters },
        selectedToolId: snapshot.selectedToolId,
        selectedElementId: snapshot.selectedElementId,
        onboardingDismissed: snapshot.onboardingDismissed,
        floors: snapshot.floors.map((floor) => this.serializeFloorState(floor)),
        activeFloorId: snapshot.activeFloorId,
        viewMode: snapshot.viewMode,
      };
      window.localStorage.setItem(this.localPlanStorageKey, JSON.stringify(payload));
    } catch {
      // Ignore persistence failures (private browsing, quota exceeded, etc.)
    }
  }

  private sanitizeStoredElement(candidate: unknown): EditorElement | null {
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const raw = candidate as Record<string, unknown>;
    const type = raw['type'];
    if (!this.isSupportedElementType(type)) {
      return null;
    }
    const id = typeof raw['id'] === 'string' ? raw['id'] : `${type}-${Math.random().toString(36).slice(2, 8)}`;
    const name = typeof raw['name'] === 'string' ? raw['name'] : this.labelForType(type);
    const positionVal = raw['position'] as { x?: unknown; y?: unknown } | undefined;
    const position = positionVal && typeof positionVal === 'object'
      ? {
          x: typeof positionVal.x === 'number' ? positionVal.x : 0,
          y: typeof positionVal.y === 'number' ? positionVal.y : 0,
        }
      : { x: 0, y: 0 };
    const rotation = typeof raw['rotation'] === 'number' ? raw['rotation'] : 0;
    const width = typeof raw['width'] === 'number' ? Math.max(raw['width'], 0.05) : 1.5;
    const depth = typeof raw['depth'] === 'number' ? Math.max(raw['depth'], 0.05) : 0.5;
    const height = typeof raw['height'] === 'number' ? Math.max(raw['height'], 0.05) : 2.8;
    const thickness = typeof raw['thickness'] === 'number' ? Math.max(raw['thickness'], 0.01) : undefined;
    const angle = typeof raw['angle'] === 'number' ? raw['angle'] : undefined;
    const source = raw['source'] === 'preset' || raw['source'] === 'imported' ? raw['source'] : 'tool';
    const assetRef = typeof raw['assetRef'] === 'string' ? raw['assetRef'] : undefined;

    return {
      id,
      type,
      name,
      position,
      rotation,
      width,
      depth,
      height,
      thickness,
      angle,
      source,
      assetRef,
    };
  }

  private sanitizeImportedAsset(candidate: unknown): ImportedAsset | null {
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const raw = candidate as Record<string, unknown>;
    if (typeof raw['id'] !== 'string' || typeof raw['fileName'] !== 'string') {
      return null;
    }
    const size = typeof raw['size'] === 'number' ? raw['size'] : 0;
    const createdAtRaw = raw['createdAt'];
    let createdAt: Date;
    if (createdAtRaw instanceof Date) {
      createdAt = createdAtRaw;
    } else if (typeof createdAtRaw === 'string') {
      const parsed = new Date(createdAtRaw);
      createdAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    } else {
      createdAt = new Date();
    }

    return {
      id: raw['id'],
      fileName: raw['fileName'],
      size,
      createdAt,
    };
  }

  private sanitizeElementCounters(input: Partial<Record<EditorElementType, number>> | null | undefined) {
    const counters: Partial<Record<EditorElementType, number>> = {};
    if (!input) {
      return counters;
    }
    for (const key of Object.keys(input) as EditorElementType[]) {
      const value = input[key];
      if (typeof value === 'number' && value >= 0) {
        counters[key] = value;
      }
    }
    return counters;
  }

  private isSupportedElementType(value: unknown): value is EditorElementType {
    return (
      value === 'wall' ||
      value === 'door' ||
      value === 'window' ||
      value === 'gutter' ||
      value === 'stairs' ||
      value === 'rail' ||
      value === 'balcony' ||
      value === 'pillar' ||
      value === 'corridor' ||
      value === 'custom'
    );
  }

  private createFloorState(name: string, elevation: number): FloorState {
    const id = `floor-${++this.lastFloorId}`;
    const now = Date.now();
    const floor: PlanFloor = {
      id,
      name,
      elevation,
      slabThickness: 0.3,
      createdAt: now,
      updatedAt: now,
    };
    return { floor, nodes: [], walls: [], rooms: [] };
  }

  private sanitizeStoredFloor(stored: StoredFloorState): FloorState {
    const floor = stored.floor ?? this.createFloorState('Floor', 0).floor;
    const normalized: PlanFloor = {
      id: floor.id ?? `floor-${++this.lastFloorId}`,
      name: typeof floor.name === 'string' && floor.name.trim() ? floor.name : 'Floor',
      elevation: typeof floor.elevation === 'number' ? floor.elevation : 0,
      slabThickness: typeof floor.slabThickness === 'number' ? floor.slabThickness : 0.3,
      createdAt: typeof floor.createdAt === 'number' ? floor.createdAt : Date.now(),
      updatedAt: typeof floor.updatedAt === 'number' ? floor.updatedAt : Date.now(),
    };

    const nodes = Array.isArray(stored.nodes)
      ? stored.nodes.map((node) => ({
          id: node.id ?? `node-${++this.lastNodeId}`,
          floorId: normalized.id,
          x: typeof node.x === 'number' ? node.x : 0,
          y: typeof node.y === 'number' ? node.y : 0,
          wallIds: Array.isArray(node.wallIds) ? [...new Set(node.wallIds.filter((id): id is string => typeof id === 'string'))] : [],
        }))
      : [];

    const walls = Array.isArray(stored.walls)
      ? stored.walls
          .map((wall) => {
            const startNodeId = typeof wall.startNodeId === 'string' ? wall.startNodeId : '';
            const endNodeId = typeof wall.endNodeId === 'string' ? wall.endNodeId : '';
            if (!startNodeId || !endNodeId) {
              return null;
            }
            return {
              id: wall.id ?? `wall-${++this.lastWallId}`,
              floorId: normalized.id,
              startNodeId,
              endNodeId,
              thickness: typeof wall.thickness === 'number' ? Math.max(wall.thickness, 0.05) : 0.2,
              height: typeof wall.height === 'number' ? Math.max(wall.height, 0.5) : 2.8,
              baseElevation: typeof wall.baseElevation === 'number' ? wall.baseElevation : normalized.elevation,
              material: wall.material,
              metadata: wall.metadata,
            } as PlanWall;
          })
          .filter((wall): wall is PlanWall => Boolean(wall))
      : [];

    const rooms = Array.isArray(stored.rooms)
      ? stored.rooms
          .map((room) => {
            const nodeRing = Array.isArray(room.nodeRing)
              ? room.nodeRing.filter((nodeId): nodeId is string => typeof nodeId === 'string')
              : [];
            const polygon = Array.isArray(room.polygon)
              ? room.polygon
                  .map((point) => ({
                    x: typeof point?.x === 'number' ? point.x : 0,
                    y: typeof point?.y === 'number' ? point.y : 0,
                  }))
              : [];
            return {
              id: room.id ?? `room-${++this.lastRoomId}`,
              floorId: normalized.id,
              nodeRing,
              polygon,
              area: typeof room.area === 'number' ? room.area : 0,
              perimeter: typeof room.perimeter === 'number' ? room.perimeter : 0,
              centroid:
                room.centroid && typeof room.centroid === 'object'
                  ? {
                      x: typeof room.centroid.x === 'number' ? room.centroid.x : 0,
                      y: typeof room.centroid.y === 'number' ? room.centroid.y : 0,
                    }
                  : { x: 0, y: 0 },
              roomType: room.roomType,
              styleRef: room.styleRef,
            } as PlanRoom;
          })
          .filter((room): room is PlanRoom => Boolean(room))
      : [];

    return { floor: normalized, nodes, walls, rooms };
  }

  private serializeFloorState(state: FloorState): StoredFloorState {
    return {
      floor: { ...state.floor, updatedAt: Date.now() },
      nodes: state.nodes.map((node) => ({
        ...node,
        wallIds: [...node.wallIds],
      })),
      walls: state.walls.map((wall) => ({
        ...wall,
      })),
      rooms: state.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map((point) => ({ ...point })),
        nodeRing: [...room.nodeRing],
      })),
    };
  }

  private cloneFloorStates(states: FloorState[]): FloorState[] {
    return states.map((state) => ({
      floor: { ...state.floor },
      nodes: state.nodes.map((node) => ({
        ...node,
        wallIds: [...node.wallIds],
      })),
      walls: state.walls.map((wall) => ({ ...wall })),
      rooms: state.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map((point) => ({ ...point })),
        nodeRing: [...room.nodeRing],
        centroid: { ...room.centroid },
      })),
    }));
  }

  private snapshotFloorsState(): PlannerHistorySnapshot {
    return {
      floors: this.cloneFloorStates(this.floorsState()),
      activeFloorId: this.activeFloorId(),
      selectedWallId: this.selectedWallId(),
      selectedRoomId: this.selectedRoomId(),
    };
  }

  private resetHistoryStacks() {
    this.undoStack = [];
    this.redoStack = [];
    this.historyReady = true;
  }

  private pushHistorySnapshot() {
    if (!this.historyReady || this.historySuspended) {
      return;
    }
    const snapshot = this.snapshotFloorsState();
    this.undoStack = [...this.undoStack, snapshot].slice(-this.historyLimit);
    this.redoStack = [];
  }

  private applyHistorySnapshot(snapshot: PlannerHistorySnapshot) {
    this.historySuspended = true;
    this.floorsState.set(this.cloneFloorStates(snapshot.floors));
    this.activeFloorId.set(snapshot.activeFloorId);
    this.selectedWallId.set(snapshot.selectedWallId);
    this.selectedRoomId.set(snapshot.selectedRoomId);
    this.reseedIdentifiersFromFloors(this.floorsState());
    this.historySuspended = false;
    this.renderPlan();
  }

  private reseedIdentifiersFromFloors(floors: FloorState[]) {
    const floorIds = floors.map((state) => Number(state.floor.id?.split('-')[1] ?? 0));
    const nodeIds = floors.flatMap((state) => state.nodes.map((node) => Number(node.id.split('-')[1] ?? 0)));
    const wallIds = floors.flatMap((state) => state.walls.map((wall) => Number(wall.id.split('-')[1] ?? 0)));
    const roomIds = floors.flatMap((state) => state.rooms.map((room) => Number(room.id.split('-')[1] ?? 0)));

    const maxFloor = floorIds.length ? Math.max(...floorIds) : this.lastFloorId;
    const maxNode = nodeIds.length ? Math.max(...nodeIds) : this.lastNodeId;
    const maxWall = wallIds.length ? Math.max(...wallIds) : this.lastWallId;
    const maxRoom = roomIds.length ? Math.max(...roomIds) : this.lastRoomId;

    this.lastFloorId = Math.max(this.lastFloorId, maxFloor);
    this.lastNodeId = Math.max(this.lastNodeId, maxNode);
    this.lastWallId = Math.max(this.lastWallId, maxWall);
    this.lastRoomId = Math.max(this.lastRoomId, maxRoom);
  }

  private ensureNodeAtPoint(
    nodes: PlanNode[],
    nodeMap: Map<string, PlanNode>,
    floorId: string,
    point: { x: number; y: number }
  ): PlanNode {
    for (const node of nodes) {
      if (node.floorId !== floorId) {
        continue;
      }
      if (this.pointsClose(node, point)) {
        return node;
      }
    }
    const node: PlanNode = {
      id: `node-${++this.lastNodeId}`,
      floorId,
      x: Number(point.x.toFixed(5)),
      y: Number(point.y.toFixed(5)),
      wallIds: [],
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
    return node;
  }

  private pointsClose(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy <= this.nodeMergeTolerance * this.nodeMergeTolerance;
  }

  private distanceFromPointToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
    const px = point.x;
    const py = point.y;
    const sx = start.x;
    const sy = start.y;
    const ex = end.x;
    const ey = end.y;
    const dx = ex - sx;
    const dy = ey - sy;
    if (dx === 0 && dy === 0) {
      return Math.hypot(px - sx, py - sy);
    }
    const t = ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const closestX = sx + clamped * dx;
    const closestY = sy + clamped * dy;
    return Math.hypot(px - closestX, py - closestY);
  }

  private pointBetween(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }, tolerance: number) {
    const minX = Math.min(start.x, end.x) - tolerance;
    const maxX = Math.max(start.x, end.x) + tolerance;
    const minY = Math.min(start.y, end.y) - tolerance;
    const maxY = Math.max(start.y, end.y) + tolerance;
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  private pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-9) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  private snapPoint(point: { x: number; y: number }) {
    const step = this.wallSnapStep;
    return {
      x: Math.round(point.x / step) * step,
      y: Math.round(point.y / step) * step,
    };
  }

  private constrainToAxis(start: { x: number; y: number }, end: { x: number; y: number }) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { x: end.x, y: start.y };
    }
    return { x: start.x, y: end.y };
  }

  private snapAxis(value: number) {
    const step = this.wallSnapStep;
    return Number((Math.round(value / step) * step).toFixed(5));
  }

  private getWallEndpoints(wall: PlanWall, nodeMap: Map<string, PlanNode>) {
    const startNode = nodeMap.get(wall.startNodeId);
    const endNode = nodeMap.get(wall.endNodeId);
    if (!startNode || !endNode) {
      throw new Error(`Wall references missing nodes: ${wall.id}`);
    }
    return {
      start: { x: startNode.x, y: startNode.y },
      end: { x: endNode.x, y: endNode.y },
    };
  }

  private wallPolygonPoints(start: { x: number; y: number }, end: { x: number; y: number }, halfThickness: number) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const nx = -uy;
    const ny = ux;
    const offsetX = nx * halfThickness;
    const offsetY = ny * halfThickness;
    return [
      { x: start.x + offsetX, y: start.y + offsetY },
      { x: end.x + offsetX, y: end.y + offsetY },
      { x: end.x - offsetX, y: end.y - offsetY },
      { x: start.x - offsetX, y: start.y - offsetY },
    ];
  }

  private segmentIntersection(
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number },
    epsilon = 1e-6
  ) {
    const r = { x: a2.x - a1.x, y: a2.y - a1.y };
    const s = { x: b2.x - b1.x, y: b2.y - b1.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < epsilon) {
      return null;
    }
    const diff = { x: b1.x - a1.x, y: b1.y - a1.y };
    const u = (diff.x * r.y - diff.y * r.x) / denom;
    const t = (diff.x * s.y - diff.y * s.x) / denom;
    if (t < -epsilon || t > 1 + epsilon || u < -epsilon || u > 1 + epsilon) {
      return null;
    }
    return {
      point: { x: a1.x + t * r.x, y: a1.y + t * r.y },
      tExisting: t,
      tNew: u,
    };
  }

  private rebuildNodeWallReferences(nodes: PlanNode[], walls: PlanWall[]) {
    nodes.forEach((node) => {
      node.wallIds = [];
    });
    const nodeMap = new Map(nodes.map((node) => [node.id, node] as const));
    walls.forEach((wall) => {
      const startNode = nodeMap.get(wall.startNodeId);
      const endNode = nodeMap.get(wall.endNodeId);
      if (startNode) {
        if (!startNode.wallIds.includes(wall.id)) {
          startNode.wallIds = [...startNode.wallIds, wall.id];
        }
      }
      if (endNode) {
        if (!endNode.wallIds.includes(wall.id)) {
          endNode.wallIds = [...endNode.wallIds, wall.id];
        }
      }
    });
  }

  private findWallAt(point: { x: number; y: number }): PlanWall | null {
    const floor = this.activeFloorState();
    if (!floor) {
      return null;
    }
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    const tolerance = Math.max(this.wallSnapStep * 0.3, 0.1);
    for (const wall of floor.walls) {
      const { start, end } = this.getWallEndpoints(wall, nodeMap);
      const distance = this.distanceFromPointToSegment(point, start, end);
      if (distance <= tolerance) {
        const withinBounds = this.pointBetween(point, start, end, tolerance);
        if (withinBounds) {
          return wall;
        }
      }
    }
    return null;
  }

  private findRoomAt(point: { x: number; y: number }): PlanRoom | null {
    const floor = this.activeFloorState();
    if (!floor) {
      return null;
    }
    const containing = floor.rooms.filter((room) => this.pointInPolygon(point, room.polygon));
    if (!containing.length) {
      return null;
    }
    return containing.reduce((smallest, current) =>
      current.area < smallest.area ? current : smallest
    );
  }

  private addWallToActiveFloor(start: { x: number; y: number }, end: { x: number; y: number }) {
    const floorId = this.activeFloorId();
    if (!floorId) {
      return;
    }
    const snappedStart = this.snapPoint(start);
    const constrainedEnd = this.constrainToAxis(snappedStart, end);
    const snappedEnd = this.snapPoint(constrainedEnd);
    if (this.pointsClose(snappedStart, snappedEnd)) {
      return;
    }

    this.pushHistorySnapshot();
    let affectedWallId: string | null = null;
    this.floorsState.update((floors) =>
      floors.map((state) => {
        if (state.floor.id !== floorId) {
          return state;
        }
        const nextState = this.insertWallSegment(state, snappedStart, snappedEnd);
        affectedWallId = nextState.walls.length ? nextState.walls[nextState.walls.length - 1]?.id ?? null : null;
        return nextState;
      })
    );

    this.renderPlan();

    if (affectedWallId) {
      this.selectedWallId.set(affectedWallId);
      this.selectedRoomId.set(null);
    }
  }

  private addRoomRectangleToActiveFloor(start: { x: number; y: number }, end: { x: number; y: number }) {
    const floorId = this.activeFloorId();
    if (!floorId) {
      return;
    }
    const snappedStart = this.snapPoint(start);
    const snappedEnd = this.snapPoint(end);
    const width = Math.abs(snappedEnd.x - snappedStart.x);
    const height = Math.abs(snappedEnd.y - snappedStart.y);
    if (width < this.wallSnapStep || height < this.wallSnapStep) {
      return;
    }

    const minX = Math.min(snappedStart.x, snappedEnd.x);
    const maxX = Math.max(snappedStart.x, snappedEnd.x);
    const minY = Math.min(snappedStart.y, snappedEnd.y);
    const maxY = Math.max(snappedStart.y, snappedEnd.y);

    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];

    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) => {
        if (state.floor.id !== floorId) {
          return state;
        }
        let updated = state;
        for (let i = 0; i < corners.length; i += 1) {
          const startCorner = corners[i];
          const nextCorner = corners[(i + 1) % corners.length];
          updated = this.insertWallSegment(updated, startCorner, nextCorner);
        }
        return this.recomputeRooms(updated);
      })
    );

    this.renderPlan();
  }

  private ensureInitialFloor() {
    if (this.floorsState().length > 0) {
      return;
    }
    const defaultFloor = this.createFloorState('Ground Floor', 0);
    this.floorsState.set([defaultFloor]);
    this.activeFloorId.set(defaultFloor.floor.id);
    this.resetHistoryStacks();
  }

  private insertWallSegment(state: FloorState, start: { x: number; y: number }, end: { x: number; y: number }): FloorState {
    const nodes = state.nodes.map((node) => ({ ...node, wallIds: [...node.wallIds] }));
    const walls = state.walls.map((wall) => ({ ...wall }));
    const nodeMap = new Map(nodes.map((node) => [node.id, node] as const));

    const startNode = this.ensureNodeAtPoint(nodes, nodeMap, state.floor.id, start);
    const endNode = this.ensureNodeAtPoint(nodes, nodeMap, state.floor.id, end);
    if (startNode.id === endNode.id) {
      return state;
    }

    const segmentStart = { x: startNode.x, y: startNode.y };
    const segmentEnd = { x: endNode.x, y: endNode.y };
    const epsilon = 1e-6;
    const splitParams: number[] = [0, 1];

    for (let i = 0; i < walls.length; i += 1) {
      const wall = walls[i];
      const { start: wallStart, end: wallEnd } = this.getWallEndpoints(wall, nodeMap);
      const intersection = this.segmentIntersection(wallStart, wallEnd, segmentStart, segmentEnd);
      if (!intersection) {
        continue;
      }
      const { point, tExisting, tNew } = intersection;
      const intersectionNode = this.ensureNodeAtPoint(nodes, nodeMap, state.floor.id, point);

      if (tExisting > epsilon && tExisting < 1 - epsilon) {
        const original = walls.splice(i, 1)[0];
        const wallA: PlanWall = {
          ...original,
          id: `wall-${++this.lastWallId}`,
          endNodeId: intersectionNode.id,
        };
        const wallB: PlanWall = {
          ...original,
          id: `wall-${++this.lastWallId}`,
          startNodeId: intersectionNode.id,
        };
        walls.splice(i, 0, wallA, wallB);
        i += 1;
      } else if (tExisting <= epsilon) {
        walls[i].startNodeId = intersectionNode.id;
      } else if (tExisting >= 1 - epsilon) {
        walls[i].endNodeId = intersectionNode.id;
      }

      if (tNew > epsilon && tNew < 1 - epsilon) {
        splitParams.push(tNew);
      }
    }

    splitParams.sort((a, b) => a - b);
    const uniqueParams = splitParams.filter((value, index, array) => index === 0 || Math.abs(value - array[index - 1]) > 1e-4);

    const segmentVector = { x: segmentEnd.x - segmentStart.x, y: segmentEnd.y - segmentStart.y };
    let previousNode = startNode;
    for (let i = 1; i < uniqueParams.length; i += 1) {
      const param = uniqueParams[i];
      const point = {
        x: segmentStart.x + segmentVector.x * param,
        y: segmentStart.y + segmentVector.y * param,
      };
      const currentNode = this.ensureNodeAtPoint(nodes, nodeMap, state.floor.id, point);
      if (previousNode.id === currentNode.id) {
        continue;
      }
      const newWall: PlanWall = {
        id: `wall-${++this.lastWallId}`,
        floorId: state.floor.id,
        startNodeId: previousNode.id,
        endNodeId: currentNode.id,
        thickness: 0.2,
        height: 3,
        baseElevation: state.floor.elevation,
      };
      walls.push(newWall);
      previousNode = currentNode;
    }

    this.rebuildNodeWallReferences(nodes, walls);
    const recomputed = this.recomputeRooms({ floor: { ...state.floor, updatedAt: Date.now() }, nodes, walls, rooms: state.rooms });
    return recomputed;
  }

  private recomputeRooms(state: FloorState): FloorState {
    const nodes = state.nodes.map((node) => ({ ...node, wallIds: [...node.wallIds] }));
    const walls = state.walls.map((wall) => ({ ...wall }));
    const rooms = this.generateRoomsFromGraph(nodes, walls, state.floor.id);
    const previousByKey = new Map(
      state.rooms.map((room) => [room.nodeRing.join('->'), room] as const)
    );
    rooms.forEach((room) => {
      const key = room.nodeRing.join('->');
      const existing = previousByKey.get(key);
      if (existing) {
        room.id = existing.id;
        room.roomType = existing.roomType;
        room.styleRef = existing.styleRef;
      } else {
        room.id = `room-${++this.lastRoomId}`;
      }
    });
    return {
      floor: { ...state.floor, updatedAt: Date.now() },
      nodes,
      walls,
      rooms,
    };
  }

  private resizeWallLength(state: FloorState, wallId: string, targetLength: number, mode: 'both' | 'start' | 'end'): FloorState {
    const nodes = state.nodes.map((node) => ({ ...node, wallIds: [...node.wallIds] }));
    const walls = state.walls.map((wall) => ({ ...wall }));
    const nodeMap = new Map(nodes.map((node) => [node.id, node] as const));
    const index = walls.findIndex((wall) => wall.id === wallId);
    if (index === -1) {
      return state;
    }
    const wall = walls[index];
    const startNode = nodeMap.get(wall.startNodeId);
    const endNode = nodeMap.get(wall.endNodeId);
    if (!startNode || !endNode) {
      return state;
    }
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const currentLength = Math.hypot(dx, dy);
    const minLength = this.wallSnapStep;
    const desiredLength = Math.max(targetLength, minLength);
    if (Math.abs(desiredLength - currentLength) < 1e-6) {
      return state;
    }
    if (currentLength < 1e-6) {
      return state;
    }
    const dirX = dx / currentLength;
    const dirY = dy / currentLength;

    const adjustments = {
      start: () => {
        startNode.x = endNode.x - dirX * desiredLength;
        startNode.y = endNode.y - dirY * desiredLength;
      },
      end: () => {
        endNode.x = startNode.x + dirX * desiredLength;
        endNode.y = startNode.y + dirY * desiredLength;
      },
      both: () => {
        const delta = (desiredLength - currentLength) / 2;
        startNode.x -= dirX * delta;
        startNode.y -= dirY * delta;
        endNode.x += dirX * delta;
        endNode.y += dirY * delta;
      },
    } as const;

    adjustments[mode]();

    const orientationHorizontal = Math.abs(dy) <= Math.abs(dx);
    if (orientationHorizontal) {
      const snappedStartX = this.snapAxis(startNode.x);
      const snappedEndX = this.snapAxis(endNode.x);
      const baselineY = this.snapAxis((startNode.y + endNode.y) / 2);
      startNode.x = snappedStartX;
      endNode.x = snappedEndX;
      startNode.y = baselineY;
      endNode.y = baselineY;
    } else {
      const snappedStartY = this.snapAxis(startNode.y);
      const snappedEndY = this.snapAxis(endNode.y);
      const baselineX = this.snapAxis((startNode.x + endNode.x) / 2);
      startNode.y = snappedStartY;
      endNode.y = snappedEndY;
      startNode.x = baselineX;
      endNode.x = baselineX;
    }

    this.rebuildNodeWallReferences(nodes, walls);
    return this.recomputeRooms({ floor: { ...state.floor }, nodes, walls, rooms: state.rooms });
  }

  private updateWallThicknessValue(state: FloorState, wallId: string, thickness: number): FloorState {
    const sanitized = Math.max(thickness, 0.05);
    const walls = state.walls.map((wall) =>
      wall.id === wallId
        ? { ...wall, thickness: sanitized }
        : wall
    );
    this.rebuildNodeWallReferences(state.nodes, walls);
    return this.recomputeRooms({ floor: { ...state.floor }, nodes: state.nodes, walls, rooms: state.rooms });
  }

  private updateWallHeightValue(state: FloorState, wallId: string, height: number): FloorState {
    const sanitized = Math.max(height, 0.5);
    const nodes = state.nodes.map((node) => ({ ...node, wallIds: [...node.wallIds] }));
    const walls = state.walls.map((wall) =>
      wall.id === wallId
        ? { ...wall, height: sanitized }
        : { ...wall }
    );
    return this.recomputeRooms({ floor: { ...state.floor, updatedAt: Date.now() }, nodes, walls, rooms: state.rooms });
  }

  private cloneFloorState(source: FloorState): FloorState {
    const elevation = source.floor.elevation + source.floor.slabThickness + 3;
    const cloned = this.createFloorState(`${source.floor.name} Copy`, elevation);
    const nodeIdMap = new Map<string, string>();
    const nodes = source.nodes.map((node) => {
      const newId = `node-${++this.lastNodeId}`;
      nodeIdMap.set(node.id, newId);
      return {
        id: newId,
        floorId: cloned.floor.id,
        x: node.x,
        y: node.y,
        wallIds: [],
      };
    });

    const walls = source.walls.map((wall) => {
      const newId = `wall-${++this.lastWallId}`;
      const startNodeId = nodeIdMap.get(wall.startNodeId);
      const endNodeId = nodeIdMap.get(wall.endNodeId);
      if (!startNodeId || !endNodeId) {
        throw new Error('Failed to clone wall due to missing node mapping');
      }
      return {
        ...wall,
        id: newId,
        floorId: cloned.floor.id,
        startNodeId,
        endNodeId,
      };
    });

    const rooms = source.rooms.map((room) => {
      const newId = `room-${++this.lastRoomId}`;
      return {
        ...room,
        id: newId,
        floorId: cloned.floor.id,
        nodeRing: room.nodeRing.map((nodeId) => nodeIdMap.get(nodeId) ?? nodeId),
        polygon: room.polygon.map((point) => ({ ...point })),
      };
    });

    this.rebuildNodeWallReferences(nodes, walls);
    return { floor: cloned.floor, nodes, walls, rooms };
  }

  private generateRoomsFromGraph(nodes: PlanNode[], walls: PlanWall[], floorId: string): PlanRoom[] {
    if (!walls.length) {
      return [];
    }
    const nodeMap = new Map(nodes.map((node) => [node.id, node] as const));
    const adjacency = new Map<string, string[]>();

    const addEdge = (from: string, to: string) => {
      if (!nodeMap.has(from) || !nodeMap.has(to)) {
        return;
      }
      const list = adjacency.get(from) ?? [];
      if (!list.includes(to)) {
        adjacency.set(from, [...list, to]);
      } else {
        adjacency.set(from, list);
      }
    };

    walls.forEach((wall) => {
      if (wall.floorId !== floorId) {
        return;
      }
      addEdge(wall.startNodeId, wall.endNodeId);
      addEdge(wall.endNodeId, wall.startNodeId);
    });

    const visited = new Set<string>();
    const rooms: PlanRoom[] = [];

    for (const wall of walls) {
      if (wall.floorId !== floorId) {
        continue;
      }
      const startId = wall.startNodeId;
      const endId = wall.endNodeId;
      const edgeKey = `${startId}->${endId}`;
      if (visited.has(edgeKey)) {
        continue;
      }
      const face = this.walkFace(startId, endId, adjacency, nodeMap, visited);
      if (!face || face.nodeRing.length < 3) {
        continue;
      }

      const polygon: { x: number; y: number }[] = [];
      let missingNode = false;
      for (const nodeId of face.nodeRing) {
        const node = nodeMap.get(nodeId);
        if (!node) {
          missingNode = true;
          break;
        }
        polygon.push({ x: node.x, y: node.y });
      }
      if (missingNode) {
        continue;
      }
      const metrics = this.computePolygonMetrics(polygon);
      if (!metrics || metrics.area <= 0.01) {
        continue;
      }

      rooms.push({
        id: '',
        floorId,
        nodeRing: [...face.nodeRing],
        polygon,
        area: metrics.area,
        perimeter: metrics.perimeter,
        centroid: metrics.centroid,
      });
    }

    return rooms;
  }

  private walkFace(
    startNodeId: string,
    nextNodeId: string,
    adjacency: Map<string, string[]>,
    nodeMap: Map<string, PlanNode>,
    visited: Set<string>
  ): { nodeRing: string[] } | null {
    const ring: string[] = [];
    let prevId = startNodeId;
    let currentId = nextNodeId;
    const startEdge = `${startNodeId}->${nextNodeId}`;
    const maxSteps = adjacency.size * 8 + 16;
    let steps = 0;

    while (steps < maxSteps) {
      steps += 1;
      visited.add(`${prevId}->${currentId}`);
      ring.push(prevId);

      const prevNode = nodeMap.get(prevId);
      const currentNode = nodeMap.get(currentId);
      if (!prevNode || !currentNode) {
        return null;
      }

      const direction = this.directionIndex(prevNode, currentNode);
      if (direction === null) {
        return null;
      }

      const candidate = this.chooseRightHandNeighbor(prevId, currentId, adjacency, nodeMap, direction, startNodeId);
      if (!candidate) {
        return null;
      }

      const nextPrev = currentId;
      const nextCurrent = candidate;
      prevId = nextPrev;
      currentId = nextCurrent;

      if (`${prevId}->${currentId}` === startEdge) {
        break;
      }
    }

    if (steps >= maxSteps) {
      return null;
    }

    return { nodeRing: ring };
  }

  private directionIndex(from: PlanNode, to: PlanNode): number | null {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const tol = 1e-6;
    if (Math.abs(dx) < tol && Math.abs(dy) < tol) {
      return null;
    }
    if (Math.abs(dy) < tol) {
      return dx > 0 ? 0 : 2; // east or west
    }
    if (Math.abs(dx) < tol) {
      return dy > 0 ? 1 : 3; // north or south
    }
    return null;
  }

  private chooseRightHandNeighbor(
    prevId: string,
    currentId: string,
    adjacency: Map<string, string[]>,
    nodeMap: Map<string, PlanNode>,
    incomingDirection: number,
    startNodeId: string
  ): string | null {
    const neighbors = adjacency.get(currentId);
    if (!neighbors || neighbors.length === 0) {
      return null;
    }
    const ordered = neighbors
      .map((neighborId) => {
        const target = nodeMap.get(neighborId);
        const current = nodeMap.get(currentId);
        if (!target || !current) {
          return null;
        }
        const dir = this.directionIndex(current, target);
        if (dir === null) {
          return null;
        }
        return { id: neighborId, dir };
      })
      .filter((item): item is { id: string; dir: number } => Boolean(item));

    if (!ordered.length) {
      return null;
    }

    const prefer = (dir: number, excludePrev = true) =>
      ordered.find((item) => item.dir === dir && (!excludePrev || item.id !== prevId));

    const rightDir = (incomingDirection + 3) % 4;
    const straightDir = incomingDirection;
    const leftDir = (incomingDirection + 1) % 4;
    const backDir = (incomingDirection + 2) % 4;

    const candidate =
      prefer(rightDir) ??
      prefer(straightDir) ??
      prefer(leftDir) ??
      prefer(backDir, false) ??
      ordered.find((item) => item.id === startNodeId) ??
      null;

    return candidate ? candidate.id : null;
  }

  private computePolygonMetrics(polygon: { x: number; y: number }[]) {
    if (polygon.length < 3) {
      return null;
    }
    let area = 0;
    let cx = 0;
    let cy = 0;
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      const cross = current.x * next.y - next.x * current.y;
      area += cross;
      cx += (current.x + next.x) * cross;
      cy += (current.y + next.y) * cross;
      perimeter += Math.hypot(next.x - current.x, next.y - current.y);
    }
    area /= 2;
    if (area <= 0) {
      return null;
    }
    const centroidFactor = 1 / (6 * area);
    return {
      area,
      perimeter,
      centroid: {
        x: cx * centroidFactor,
        y: cy * centroidFactor,
      },
    };
  }

  readonly selectedToolId = signal<string>('select');
  readonly elements = signal<EditorElement[]>([]);
  readonly selectedElementId = signal<string | null>(null);
  readonly selectedElement = computed(() =>
    this.elements().find((el) => el.id === this.selectedElementId()) ?? null
  );
  readonly importedAssets = signal<ImportedAsset[]>([]);
  readonly localCursor = signal<{ x: number; y: number; label: string; color: string } | null>(null);
  readonly onboardingVisible = signal(false);
  private readonly onboardingDismissed = signal(false);
  readonly floorsState = signal<FloorState[]>([]);
  readonly activeFloorId = signal<string>('');
  readonly selectedWallId = signal<string | null>(null);
  readonly selectedRoomId = signal<string | null>(null);
  readonly wallResizeMode = signal<'both' | 'start' | 'end'>('both');
  readonly planView = signal({ scale: 1, offsetX: 0, offsetY: 0 });
  readonly selectedWall = computed(() => {
    const floor = this.activeFloorState();
    if (!floor) return null;
    const id = this.selectedWallId();
    return floor.walls.find((wall) => wall.id === id) ?? null;
  });
  readonly selectedRoom = computed(() => {
    const floor = this.activeFloorState();
    if (!floor) return null;
    const id = this.selectedRoomId();
    return floor.rooms.find((room) => room.id === id) ?? null;
  });
  readonly shortcutEntries = [
    { combo: '1', description: 'Switch to Select tool' },
    { combo: 'W', description: 'Activate Wall tool' },
    { combo: 'D', description: 'Activate Door tool' },
    { combo: 'Shift + Drag', description: 'Constrain move to axis' },
    { combo: '⌘ / Ctrl + Z', description: 'Undo last action' },
    { combo: '⌘ / Ctrl + Y', description: 'Redo' },
    { combo: 'Delete', description: 'Remove selected element' },
    { combo: 'Space + Drag', description: 'Pan 2D viewport' },
    { combo: 'Scroll', description: 'Zoom 2D/3D view' },
    { combo: 'F', description: 'Frame selection in 3D' },
  ];

  readonly roomTypePresets: readonly string[] = [
    'Living',
    'Kitchen',
    'Dining',
    'Bedroom',
    'Bathroom',
    'Study',
    'Utility',
    'Storage',
  ];

  private planContext?: CanvasRenderingContext2D;
  private planRenderEffect?: EffectRef;
  private sceneRenderEffect?: EffectRef;
  private localPlanEffect?: EffectRef;
  private dragState?: { elementId: string; offset: { x: number; y: number } };
  private lastElementId = 0;
  private localCursorColor = '#f97316';
  private currentSpaceId: string | null = null;
  private paramSubscription?: Subscription;
  private elementCounters: Partial<Record<EditorElementType, number>> = {};
  private lastAssetId = 0;
  private elementMeshes = new Map<string, THREE.Object3D>();
  private readonly localPlanStorageKey = 'kouru-plan-studio';
  private lastFloorId = 0;
  private lastNodeId = 0;
  private lastWallId = 0;
  private lastRoomId = 0;
  private undoStack: PlannerHistorySnapshot[] = [];
  private redoStack: PlannerHistorySnapshot[] = [];
  private readonly historyLimit = 50;
  private historyReady = false;
  private historySuspended = false;
  private readonly wallSnapStep = 0.25;
  private readonly nodeMergeTolerance = 0.05;
  private drawWallStart: { x: number; y: number } | null = null;
  private drawRoomStart: { x: number; y: number } | null = null;
  private wallPreview: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
  private roomPreview: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
  private panState:
    | {
        pointerId: number;
        start: { x: number; y: number };
        origin: { offsetX: number; offsetY: number };
        originWorld: { x: number; y: number };
      }
    | null = null;

  readonly quickStartTemplates: QuickStartTemplate[] = this.isSingleUserMode ? this.buildQuickStartTemplates() : [];
  readonly viewMode = signal<ViewMode>('plan');
  readonly viewOptions: Array<{ id: ViewMode; label: string; hint: string }> = [
    { id: 'plan', label: '2D', hint: 'Focus on plan' },
    { id: 'scene', label: '3D', hint: 'Explore the model' },
    { id: 'split', label: 'Dual', hint: 'Show both views' },
  ];
  readonly showPlan = computed(() => {
    const mode = this.viewMode();
    return mode === 'plan' || mode === 'split';
  });
  readonly showScene = computed(() => {
    const mode = this.viewMode();
    return mode === 'scene' || mode === 'split';
  });
  readonly viewportPanelsClass = computed(() => {
    const mode = this.viewMode();
    if (mode === 'split') {
      return ['grid-cols-1', 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'];
    }
    return ['grid-cols-1'];
  });
  readonly activeFloorState = computed(() => {
    const id = this.activeFloorId();
    return this.floorsState().find((item) => item.floor.id === id) ?? null;
  });

  readonly projectId$ = this.route.paramMap.pipe(map((params) => params.get('projectId') ?? ''));
  readonly spaceId$ = this.route.paramMap.pipe(map((params) => params.get('spaceId') ?? ''));

  readonly project$ = this.isSingleUserMode
    ? of(null)
    : this.projectId$.pipe(
        filter((id): id is string => Boolean(id)),
        switchMap((id) => this.projects.get(id))
      );
  readonly members$ = this.isSingleUserMode
    ? of<SpaceMember[]>([])
    : this.spaceId$.pipe(
        filter((id): id is string => Boolean(id)),
        switchMap((id) => this.spaces.listMembers(id))
      );
  readonly cursors$ = this.cursors.cursors$;

  readonly status = signal(this.isSingleUserMode ? 'ready' : 'idle');

  private planCanvas?: ElementRef<HTMLCanvasElement>;
  private sceneCanvas?: ElementRef<HTMLCanvasElement>;
  private readonly injector = inject(Injector);

  @ViewChild('planCanvas', { static: false })
  set planCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    if (value) {
      this.planCanvas = value;
      this.preparePlanCanvas(value.nativeElement);
      if (!this.planRenderEffect) {
        runInInjectionContext(this.injector, () => {
          this.planRenderEffect = effect(() => {
            this.elements();
            this.floorsState();
            this.activeFloorId();
            this.selectedElementId();
            this.selectedWallId();
            this.selectedRoomId();
            this.planView();
            this.renderPlan();
          });
        });
      }
    } else {
      this.planCanvas = undefined;
      this.planContext = undefined;
      this.planRenderEffect?.destroy();
      this.planRenderEffect = undefined;
    }
  }

  @ViewChild('sceneCanvas', { static: false })
  set sceneCanvasRef(value: ElementRef<HTMLCanvasElement> | undefined) {
    if (value) {
      this.sceneCanvas = value;
      this.ensureSceneInitialized(value.nativeElement);
    } else {
      this.sceneCanvas = undefined;
      this.disposeSceneBundle();
    }
  }

  private sceneBundle?: ReturnType<typeof createScene>;

  ngOnInit() {
    if (!this.isSingleUserMode) {
      this.viewMode.set('split');
    }
    if (this.isSingleUserMode) {
      const { hasElements } = this.restoreLocalPlanSnapshot();
      this.ensureInitialFloor();
      runInInjectionContext(this.injector, () => {
        this.localPlanEffect = effect(() => {
          this.writeLocalPlanSnapshot({
            elements: this.elements(),
            importedAssets: this.importedAssets(),
            lastElementId: this.lastElementId,
            lastAssetId: this.lastAssetId,
            elementCounters: { ...this.elementCounters },
            selectedToolId: this.selectedToolId(),
            selectedElementId: this.selectedElementId(),
            onboardingDismissed: this.onboardingDismissed(),
            floors: this.floorsState(),
            activeFloorId: this.activeFloorId(),
            viewMode: this.viewMode(),
          });
        });
      });
      if (!this.onboardingDismissed() && !hasElements) {
        this.onboardingVisible.set(true);
      }
      this.status.set('ready');
      return;
    }
    this.ensureInitialFloor();
    this.paramSubscription = combineLatest([this.projectId$, this.spaceId$]).subscribe(([projectId, spaceId]) => {
      if (spaceId && spaceId !== this.currentSpaceId) {
        const color = this.randomColor();
        this.localCursorColor = color;
        this.cursors.connect(spaceId, 'You', color);
      }
      this.currentSpaceId = spaceId ?? null;
      if (projectId) {
        this.status.set('loading');
        this.projects.getDoc(projectId, 'plan2d').subscribe({
          next: () => this.status.set('ready'),
          error: () => this.status.set('error'),
        });
      }
    });
  }

  private preparePlanCanvas(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    if (width && height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    this.planContext = context ?? undefined;
    this.renderPlan();
  }

  private ensureSceneInitialized(canvas: HTMLCanvasElement) {
    if (this.sceneBundle) {
      return;
    }
    const bundle = createScene(canvas);
    addGrid(bundle.scene);
    animate(bundle, () => resizeRenderer(bundle));
    this.sceneBundle = bundle;
    if (!this.sceneRenderEffect) {
      runInInjectionContext(this.injector, () => {
        this.sceneRenderEffect = effect(() => {
          this.elements();
          this.floorsState();
          this.selectedElementId();
          this.selectedWallId();
          this.syncSceneElements();
        });
      });
    }
    this.syncSceneElements();
  }

  private renderPlan() {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas || !this.planContext) {
      return;
    }
    const ctx = this.planContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawPlanGrid(ctx, canvas);
    const floor = this.activeFloorState();
    if (floor) {
      this.drawPlanRooms(ctx, floor);
      this.drawPlanWalls(ctx, floor);
    }
    this.drawWallPreviewShape(ctx);
    this.drawRoomPreviewShape(ctx);
    for (const element of this.elements()) {
      this.drawPlanElement(ctx, element);
    }
    const selected = this.selectedElement();
    if (selected) {
      this.drawSelectionOutline(ctx, selected);
    }
    const selectedWall = this.selectedWall();
    if (selectedWall && floor) {
      this.highlightWall(ctx, selectedWall, floor);
    }
    const selectedRoom = this.selectedRoom();
    if (selectedRoom) {
      this.highlightRoom(ctx, selectedRoom);
    }
    ctx.restore();
  }

  private drawPlanWalls(ctx: CanvasRenderingContext2D, floor: FloorState) {
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(30, 64, 175, 0.9)';
    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    for (const wall of floor.walls) {
      const { start, end } = this.getWallEndpoints(wall, nodeMap);
      const points = this.wallPolygonPoints(start, end, wall.thickness / 2);
      ctx.beginPath();
      const canvasPoints = points.map((p) => this.worldToCanvas(p));
      canvasPoints.forEach((pt, index) => {
        if (index === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPlanRooms(ctx: CanvasRenderingContext2D, floor: FloorState) {
    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.lineWidth = 1;
    for (const room of floor.rooms) {
      if (!room.polygon.length) {
        continue;
      }
      ctx.beginPath();
      room.polygon.forEach((point, index) => {
        const canvasPoint = this.worldToCanvas(point);
        if (index === 0) {
          ctx.moveTo(canvasPoint.x, canvasPoint.y);
        } else {
          ctx.lineTo(canvasPoint.x, canvasPoint.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawWallPreviewShape(ctx: CanvasRenderingContext2D) {
    if (!this.wallPreview) {
      return;
    }
    const { start, end } = this.wallPreview;
    const points = this.wallPolygonPoints(start, end, 0.1);
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    points.forEach((point, index) => {
      const canvasPoint = this.worldToCanvas(point);
      if (index === 0) {
        ctx.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawRoomPreviewShape(ctx: CanvasRenderingContext2D) {
    if (!this.roomPreview) {
      return;
    }
    const { start, end } = this.roomPreview;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.beginPath();
    corners.forEach((corner, index) => {
      const canvasPoint = this.worldToCanvas(corner);
      if (index === 0) {
        ctx.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private highlightWall(ctx: CanvasRenderingContext2D, wall: PlanWall, floor: FloorState) {
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    const { start, end } = this.getWallEndpoints(wall, nodeMap);
    const points = this.wallPolygonPoints(start, end, wall.thickness / 2);
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((point, index) => {
      const canvasPoint = this.worldToCanvas(point);
      if (index === 0) {
        ctx.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private highlightRoom(ctx: CanvasRenderingContext2D, room: PlanRoom) {
    if (!room.polygon.length) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    room.polygon.forEach((point, index) => {
      const canvasPoint = this.worldToCanvas(point);
      if (index === 0) {
        ctx.moveTo(canvasPoint.x, canvasPoint.y);
      } else {
        ctx.lineTo(canvasPoint.x, canvasPoint.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawPlanGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const view = this.planView();
    const factor = this.pixelsPerMeter * view.scale;
    const majorStep = factor;
    const minorStep = majorStep / 2;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2 + view.offsetX * factor;
    const centerY = height / 2 - view.offsetY * factor;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';

    for (let x = centerX; x < width; x += minorStep) {
      this.drawGridLine(ctx, x, 0, x, height);
    }
    for (let x = centerX; x > 0; x -= minorStep) {
      this.drawGridLine(ctx, x, 0, x, height);
    }
    for (let y = centerY; y < height; y += minorStep) {
      this.drawGridLine(ctx, 0, y, width, y);
    }
    for (let y = centerY; y > 0; y -= minorStep) {
      this.drawGridLine(ctx, 0, y, width, y);
    }

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1.5;

    for (let x = centerX; x < width; x += majorStep) {
      this.drawGridLine(ctx, x, 0, x, height);
    }
    for (let x = centerX; x > 0; x -= majorStep) {
      this.drawGridLine(ctx, x, 0, x, height);
    }
    for (let y = centerY; y < height; y += majorStep) {
      this.drawGridLine(ctx, 0, y, width, y);
    }
    for (let y = centerY; y > 0; y -= majorStep) {
      this.drawGridLine(ctx, 0, y, width, y);
    }

    ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
    ctx.lineWidth = 1.8;
    this.drawGridLine(ctx, centerX, 0, centerX, height);
    this.drawGridLine(ctx, 0, centerY, width, centerY);
    ctx.restore();
  }

  private drawGridLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawPlanElement(ctx: CanvasRenderingContext2D, element: EditorElement) {
    const canvasPosition = this.worldToCanvas(element.position);
    const widthPx = element.width * this.pixelsPerMeter;
    const depthPx = element.depth * this.pixelsPerMeter;
    const rotation = ((element.rotation ?? 0) * Math.PI) / 180;
    const palette = this.elementColor(element.type);

    ctx.save();
    ctx.translate(canvasPosition.x, canvasPosition.y);
    ctx.rotate(-rotation);
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-widthPx / 2, -depthPx / 2, widthPx, depthPx);
    ctx.fill();
    ctx.stroke();

    if (element.type === 'door') {
      this.drawDoorSwing(ctx, element, widthPx, depthPx);
    }
    if (element.type === 'stairs') {
      this.drawStairTreads(ctx, element, widthPx, depthPx);
    }

    ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(element.name, 0, -depthPx / 2 - 6);
    ctx.restore();
  }

  private drawSelectionOutline(ctx: CanvasRenderingContext2D, element: EditorElement) {
    const canvasPosition = this.worldToCanvas(element.position);
    const widthPx = element.width * this.pixelsPerMeter;
    const depthPx = element.depth * this.pixelsPerMeter;
    const rotation = ((element.rotation ?? 0) * Math.PI) / 180;

    ctx.save();
    ctx.translate(canvasPosition.x, canvasPosition.y);
    ctx.rotate(-rotation);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.9)';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.rect(-widthPx / 2 - 4, -depthPx / 2 - 4, widthPx + 8, depthPx + 8);
    ctx.stroke();
    ctx.restore();
  }

  private drawDoorSwing(
    ctx: CanvasRenderingContext2D,
    element: EditorElement,
    widthPx: number,
    depthPx: number
  ) {
    const angle = (element.angle ?? 90) * (Math.PI / 180);
    const radius = widthPx;
    ctx.save();
    ctx.translate(-widthPx / 2, depthPx / 2);
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + angle, false);
    ctx.stroke();
    ctx.restore();
  }

  private drawStairTreads(
    ctx: CanvasRenderingContext2D,
    element: EditorElement,
    widthPx: number,
    depthPx: number
  ) {
    const treadCount = Math.max(3, Math.round((element.height ?? 3) / 0.18));
    const treadDepth = depthPx / treadCount;
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.lineWidth = 1;
    for (let i = 1; i < treadCount; i += 1) {
      const y = -depthPx / 2 + i * treadDepth;
      ctx.beginPath();
      ctx.moveTo(-widthPx / 2, y);
      ctx.lineTo(widthPx / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private elementColor(type: EditorElementType) {
    switch (type) {
      case 'wall':
        return { fill: 'rgba(79, 70, 229, 0.28)', stroke: 'rgba(129, 140, 248, 0.9)' };
      case 'door':
        return { fill: 'rgba(96, 165, 250, 0.2)', stroke: 'rgba(59, 130, 246, 0.95)' };
      case 'window':
        return { fill: 'rgba(56, 189, 248, 0.18)', stroke: 'rgba(14, 165, 233, 0.9)' };
      case 'gutter':
        return { fill: 'rgba(34, 197, 94, 0.15)', stroke: 'rgba(74, 222, 128, 0.85)' };
      case 'stairs':
        return { fill: 'rgba(244, 114, 182, 0.2)', stroke: 'rgba(236, 72, 153, 0.85)' };
      case 'rail':
        return { fill: 'rgba(248, 113, 113, 0.24)', stroke: 'rgba(239, 68, 68, 0.85)' };
      case 'balcony':
        return { fill: 'rgba(234, 179, 8, 0.18)', stroke: 'rgba(250, 204, 21, 0.9)' };
      case 'pillar':
        return { fill: 'rgba(161, 161, 170, 0.3)', stroke: 'rgba(228, 228, 231, 0.9)' };
      case 'corridor':
        return { fill: 'rgba(59, 130, 246, 0.18)', stroke: 'rgba(37, 99, 235, 0.9)' };
      default:
        return { fill: 'rgba(148, 163, 184, 0.2)', stroke: 'rgba(148, 163, 184, 0.85)' };
    }
  }

  private colorForType3d(type: EditorElementType) {
    switch (type) {
      case 'wall':
        return 0x6366f1;
      case 'door':
        return 0x3b82f6;
      case 'window':
        return 0x0ea5e9;
      case 'gutter':
        return 0x22c55e;
      case 'stairs':
        return 0xec4899;
      case 'rail':
        return 0xf97316;
      case 'balcony':
        return 0xfacc15;
      case 'pillar':
        return 0xa1a1aa;
      case 'corridor':
        return 0x2563eb;
      default:
        return 0x94a3b8;
    }
  }

  private worldToCanvas(position: { x: number; y: number }) {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const view = this.planView();
    const factor = this.pixelsPerMeter * view.scale;
    return {
      x: centerX + (position.x + view.offsetX) * factor,
      y: centerY - (position.y + view.offsetY) * factor,
    };
  }

  private canvasToWorld(point: { x: number; y: number }) {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const view = this.planView();
    const factor = this.pixelsPerMeter * view.scale;
    const worldX = (point.x - centerX) / factor - view.offsetX;
    const worldY = (centerY - point.y) / factor - view.offsetY;
    return {
      x: Number(worldX.toFixed(3)),
      y: Number(worldY.toFixed(3)),
    };
  }

  private pointerEventToCanvas(event: PointerEvent) {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  }

  private findElementAt(point: { x: number; y: number }) {
    const elements = [...this.elements()].reverse();
    for (const element of elements) {
      const local = this.toLocalPoint(element, point);
      const halfWidth = element.width / 2;
      const halfDepth = element.depth / 2;
      if (Math.abs(local.x) <= halfWidth && Math.abs(local.y) <= halfDepth) {
        return element;
      }
    }
    return null;
  }

  private toLocalPoint(element: EditorElement, point: { x: number; y: number }) {
    const dx = point.x - element.position.x;
    const dy = point.y - element.position.y;
    const rad = ((element.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(-rad);
    const sin = Math.sin(-rad);
    return {
      x: dx * cos - dy * sin,
      y: dx * sin + dy * cos,
    };
  }

  selectTool(toolId: string) {
    this.selectedToolId.set(toolId);
  }

  isToolSelected(toolId: string) {
    return this.selectedToolId() === toolId;
  }

  setViewMode(mode: ViewMode) {
    this.viewMode.set(mode);
  }

  isViewMode(mode: ViewMode) {
    return this.viewMode() === mode;
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent) {
    if (!this.isSingleUserMode) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName?.toLowerCase();
      const contentEditable = target.getAttribute?.('contenteditable');
      if (tagName === 'input' || tagName === 'textarea' || contentEditable === 'true') {
        return;
      }
    }
    const isModifier = event.metaKey || event.ctrlKey;
    if (!isModifier) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      this.redo();
    }
  }

  onPlanPointerMove(event: PointerEvent) {
    const canvasPoint = this.pointerEventToCanvas(event);
    if (!canvasPoint) {
      return;
    }
    const world = this.canvasToWorld(canvasPoint);
    if (this.panState) {
      const canvas = this.planCanvas?.nativeElement;
      if (!canvas) {
        return;
      }
      const view = this.planView();
      const factor = this.pixelsPerMeter * view.scale;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const offsetX = (canvasPoint.x - centerX) / factor - this.panState.originWorld.x;
      const offsetY = (centerY - canvasPoint.y) / factor - this.panState.originWorld.y;
      this.planView.set({ scale: view.scale, offsetX, offsetY });
      this.renderPlan();
      return;
    }
    if (this.isSingleUserMode && this.drawWallStart && this.selectedToolId() === 'draw-wall') {
      const snapped = this.snapPoint(this.constrainToAxis(this.drawWallStart, world));
      this.wallPreview = { start: this.drawWallStart, end: snapped };
      this.renderPlan();
      return;
    }
    if (this.isSingleUserMode && this.drawRoomStart && this.selectedToolId() === 'draw-room') {
      const snapped = this.snapPoint(world);
      this.roomPreview = { start: this.drawRoomStart, end: snapped };
      this.renderPlan();
      return;
    }
    this.updateLocalCursor(canvasPoint.x, canvasPoint.y);
    if (this.currentSpaceId) {
      this.cursors.send(this.currentSpaceId, canvasPoint.x, canvasPoint.y);
    }
    if (this.dragState) {
      this.moveDraggedElement(world);
    }
  }

  onPlanWheel(event: WheelEvent) {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas) {
      return;
    }
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const worldBefore = this.canvasToWorld({ x: canvasX, y: canvasY });
    const view = this.planView();
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(5, Math.max(0.2, view.scale * zoomFactor));
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const factor = this.pixelsPerMeter * newScale;
    const newOffsetX = (canvasX - centerX) / factor - worldBefore.x;
    const newOffsetY = (centerY - canvasY) / factor - worldBefore.y;
    this.planView.set({ scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY });
    this.renderPlan();
  }

  setScenePreset(preset: 'iso' | 'top' | 'reset') {
    const bundle = this.sceneBundle;
    if (!bundle) {
      return;
    }
    const { camera, controls } = bundle;
    if (preset === 'top') {
      camera.position.set(0, 12, 0.0001);
      controls.target.set(0, 0, 0);
      camera.up.set(0, 0, -1);
    } else if (preset === 'iso' || preset === 'reset') {
      camera.position.set(6, 6, 6);
      controls.target.set(0, 0, 0);
      camera.up.set(0, 1, 0);
    }
    controls.update();
  }

  onPlanPointerDown(event: PointerEvent) {
    event.preventDefault();
    const canvasPoint = this.pointerEventToCanvas(event);
    if (!canvasPoint) {
      return;
    }
    const toolId = this.selectedToolId();
    const world = this.canvasToWorld(canvasPoint);
    const capturePointer = () => {
      if (event.pointerId && event.target instanceof HTMLElement) {
        event.target.setPointerCapture(event.pointerId);
        return true;
      }
      return false;
    };
    const beginPan = () => {
      pointerCaptured = capturePointer();
      const view = this.planView();
      const originWorld = this.canvasToWorld({ x: canvasPoint.x, y: canvasPoint.y });
      this.panState = {
        pointerId: event.pointerId ?? -1,
        start: { x: canvasPoint.x, y: canvasPoint.y },
        origin: { offsetX: view.offsetX, offsetY: view.offsetY },
        originWorld,
      };
    };
    let pointerCaptured = false;
    const isPanGesture = event.button === 1 || event.button === 2 || (event.button === 0 && event.altKey);
    if (isPanGesture) {
      beginPan();
      return;
    }
    if (toolId === 'draw-wall' && this.isSingleUserMode) {
      const snapped = this.snapPoint(world);
      this.drawWallStart = snapped;
      this.wallPreview = { start: snapped, end: snapped };
      this.selectedElementId.set(null);
      this.selectedWallId.set(null);
      this.selectedRoomId.set(null);
    } else if (toolId === 'draw-room' && this.isSingleUserMode) {
      const snapped = this.snapPoint(world);
      this.drawRoomStart = snapped;
      this.roomPreview = { start: snapped, end: snapped };
      this.selectedElementId.set(null);
      this.selectedWallId.set(null);
      this.selectedRoomId.set(null);
    } else if (toolId !== 'select') {
      const tool = this.findToolById(toolId);
      if (tool && tool.type !== 'select') {
        const element = this.instantiateElement(tool, world, 'tool');
        this.elements.update((items) => [...items, element]);
        this.selectedElementId.set(element.id);
        this.selectedWallId.set(null);
        this.selectedRoomId.set(null);
      }
    } else {
      const wallHit = this.isSingleUserMode ? this.findWallAt(world) : null;
      if (wallHit) {
        this.selectedWallId.set(wallHit.id);
        this.selectedRoomId.set(null);
        this.selectedElementId.set(null);
        this.wallResizeMode.set('both');
      } else {
        const roomHit = this.isSingleUserMode ? this.findRoomAt(world) : null;
        if (roomHit) {
          this.selectedRoomId.set(roomHit.id);
          this.selectedWallId.set(null);
          this.selectedElementId.set(null);
          this.wallResizeMode.set('both');
        } else {
          const hit = this.findElementAt(world);
          if (hit) {
            this.selectedElementId.set(hit.id);
            this.selectedWallId.set(null);
            this.selectedRoomId.set(null);
            this.wallResizeMode.set('both');
            this.dragState = {
              elementId: hit.id,
              offset: { x: world.x - hit.position.x, y: world.y - hit.position.y },
            };
          } else {
            this.selectedElementId.set(null);
            this.selectedWallId.set(null);
            this.selectedRoomId.set(null);
            this.wallResizeMode.set('both');
            if (event.button === 0) {
              beginPan();
              return;
            }
          }
        }
      }
    }
    if (!pointerCaptured) {
      pointerCaptured = capturePointer();
    }
  }

  onPlanPointerUp(event: PointerEvent) {
    const toolId = this.selectedToolId();
    if (toolId === 'draw-wall' && this.isSingleUserMode && this.drawWallStart && this.wallPreview) {
      this.addWallToActiveFloor(this.wallPreview.start, this.wallPreview.end);
      this.drawWallStart = null;
      this.wallPreview = null;
      this.renderPlan();
    } else if (toolId === 'draw-room' && this.isSingleUserMode && this.drawRoomStart && this.roomPreview) {
      this.addRoomRectangleToActiveFloor(this.roomPreview.start, this.roomPreview.end);
      this.drawRoomStart = null;
      this.roomPreview = null;
      this.renderPlan();
    }
    this.dragState = undefined;
    this.panState = null;
    if (event.pointerId && event.target instanceof HTMLElement) {
      event.target.releasePointerCapture(event.pointerId);
    }
  }

  onPlanPointerLeave() {
    this.dragState = undefined;
    this.drawWallStart = null;
    this.drawRoomStart = null;
    this.wallPreview = null;
    this.roomPreview = null;
    this.panState = null;
    this.localCursor.set(null);
  }

  private moveDraggedElement(world: { x: number; y: number }) {
    if (!this.dragState) {
      return;
    }
    const { elementId, offset } = this.dragState;
    this.elements.update((items) =>
      items.map((item) =>
        item.id === elementId
          ? {
              ...item,
              position: { x: world.x - offset.x, y: world.y - offset.y },
            }
          : item
      )
    );
  }

  private updateLocalCursor(x: number, y: number) {
    this.localCursor.set({ x, y, label: 'You', color: this.localCursorColor });
  }

  private findToolById(toolId: string) {
    for (const group of this.toolGroups) {
      const tool = group.tools.find((candidate) => candidate.id === toolId);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  private findToolByType(type: EditorElementType) {
    for (const group of this.toolGroups) {
      const tool = group.tools.find((candidate) => candidate.type === type);
      if (tool && tool.type !== 'select') {
        return tool;
      }
    }
    return undefined;
  }

  private instantiateElement(
    tool: ToolDefinition,
    position: { x: number; y: number },
    source: EditorElement['source'],
    overrides: Partial<EditorElement> = {}
  ): EditorElement {
    if (tool.type === 'select') {
      throw new Error('Cannot instantiate select tool');
    }
    const defaults = tool.defaults ?? {};
    const width = overrides.width ?? defaults.width ?? 1.2;
    const depth = overrides.depth ?? defaults.depth ?? 0.2;
    const height = overrides.height ?? defaults.height ?? 2.8;
    const thickness = overrides.thickness ?? defaults.thickness;
    const angle = overrides.angle ?? defaults.angle ?? 0;
    const rotation = overrides.rotation ?? defaults.rotation ?? 0;
    const name =
      overrides.name ??
      defaults.name ??
      `${this.labelForType(tool.type)} ${this.nextElementIndex(tool.type)}`;

    const id = `${tool.type}-${++this.lastElementId}`;

    return {
      id,
      type: tool.type,
      name,
      position: { ...position },
      rotation,
      width,
      depth,
      height,
      thickness,
      angle,
      source,
      assetRef: overrides.assetRef ?? undefined,
    };
  }

  private labelForType(type: EditorElementType) {
    switch (type) {
      case 'wall':
        return 'Wall';
      case 'door':
        return 'Door';
      case 'window':
        return 'Window';
      case 'gutter':
        return 'Gutter';
      case 'stairs':
        return 'Stair';
      case 'rail':
        return 'Rail';
      case 'balcony':
        return 'Balcony';
      case 'pillar':
        return 'Pillar';
      case 'corridor':
        return 'Corridor';
      default:
        return 'Mass';
    }
  }

  private nextElementIndex(type: EditorElementType) {
    const current = this.elementCounters[type] ?? 0;
    const next = current + 1;
    this.elementCounters[type] = next;
    return next.toString().padStart(2, '0');
  }

  propertyLabel(property: NumericProperty) {
    switch (property) {
      case 'width':
        return 'Width (m)';
      case 'depth':
        return 'Depth (m)';
      case 'height':
        return 'Height (m)';
      case 'thickness':
        return 'Thickness (m)';
      case 'angle':
        return 'Angle (°)';
      default:
        return property;
    }
  }

  sourceLabel(source: EditorElement['source']) {
    switch (source) {
      case 'tool':
        return 'Tool placement';
      case 'preset':
        return 'Predesigned asset';
      case 'imported':
        return 'Imported asset';
      default:
        return 'Unknown';
    }
  }

  updateSelectedElementProperty(key: NumericProperty, value: number | string) {
    const element = this.selectedElement();
    if (!element) {
      return;
    }
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) {
      return;
    }
    const next = Math.max(0.05, numeric);
    this.elements.update((items) =>
      items.map((item) => (item.id === element.id ? { ...item, [key]: next } : item))
    );
  }

  updateSelectedElementName(value: string) {
    const element = this.selectedElement();
    if (!element) {
      return;
    }
    const name = value.trim() || element.name;
    this.elements.update((items) =>
      items.map((item) => (item.id === element.id ? { ...item, name } : item))
    );
  }

  getNumericProperty(element: EditorElement, property: NumericProperty) {
    return (element as Record<NumericProperty, number | undefined>)[property] ?? 0;
  }

  memberInitials(member: SpaceMember) {
    const name = member.user?.displayName ?? '';
    if (!name.trim()) {
      return '?';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${first}${last}`;
  }

  deleteSelectedElement() {
    const elementId = this.selectedElementId();
    if (!elementId) {
      return;
    }
    this.elements.update((items) => items.filter((item) => item.id !== elementId));
    this.selectedElementId.set(null);
  }

  duplicateSelectedElement() {
    const element = this.selectedElement();
    if (!element) {
      return;
    }
    const tool = this.findToolByType(element.type);
    if (!tool) {
      return;
    }
    const offsetPosition = {
      x: element.position.x + 0.5,
      y: element.position.y - 0.5,
    };
    const clone = this.instantiateElement(tool, offsetPosition, element.source, {
      ...element,
      position: offsetPosition,
      name: `${element.name} Copy`,
    });
    this.elements.update((items) => [...items, clone]);
    this.selectedElementId.set(clone.id);
  }

  applyPresetAsset(asset: PresetAsset) {
    const tool = this.findToolByType(asset.type);
    if (!tool) {
      return;
    }
    const element = this.instantiateElement(tool, { x: 0, y: 0 }, 'preset', asset.element);
    this.elements.update((items) => [...items, element]);
    this.selectedElementId.set(element.id);
    this.selectedToolId.set('select');
  }

  onAssetImport(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;
    if (!files || files.length === 0) {
      return;
    }
    const additions: ImportedAsset[] = Array.from(files).map((file) => ({
      id: `asset-${++this.lastAssetId}`,
      fileName: file.name,
      size: file.size,
      createdAt: new Date(),
    }));
    this.importedAssets.update((items) => [...items, ...additions]);
    if (input) {
      input.value = '';
    }
  }

  placeImportedAsset(asset: ImportedAsset) {
    const tool = this.findToolById('custom');
    if (!tool || tool.type === 'select') {
      return;
    }
    const element = this.instantiateElement(tool, { x: 0, y: 0 }, 'imported', {
      name: asset.fileName,
      width: 2,
      depth: 2,
      height: 2,
      assetRef: asset.id,
    });
    this.elements.update((items) => [...items, element]);
    this.selectedElementId.set(element.id);
    this.selectedToolId.set('select');
  }

  startBlankPlan() {
    if (!this.isSingleUserMode) {
      return;
    }
    this.resetPlanState();
    this.onboardingDismissed.set(true);
    this.onboardingVisible.set(false);
  }

  applyQuickStartTemplate(template: QuickStartTemplate) {
    if (!this.isSingleUserMode) {
      return;
    }
    this.pushHistorySnapshot();
    this.resetPlanState();
    if (template.floors && template.floors.length) {
      const seededFloors: FloorState[] = [];
      for (const floorConfig of template.floors) {
        let floorState = this.createFloorState(floorConfig.name, floorConfig.elevation);
        floorState = {
          floor: {
            ...floorState.floor,
            slabThickness: floorConfig.slabThickness ?? floorState.floor.slabThickness,
          },
          nodes: floorState.nodes,
          walls: floorState.walls,
          rooms: floorState.rooms,
        };
        for (const wallConfig of floorConfig.walls) {
          const previousWallIds = new Set(floorState.walls.map((wall) => wall.id));
          let nextState = this.insertWallSegment(floorState, wallConfig.start, wallConfig.end);
          if (wallConfig.thickness !== undefined || wallConfig.height !== undefined) {
            const adjustedWalls = nextState.walls.map((wall) =>
              previousWallIds.has(wall.id)
                ? wall
                : {
                    ...wall,
                    thickness: wallConfig.thickness ?? wall.thickness,
                    height: wallConfig.height ?? wall.height,
                  }
            );
            nextState = this.recomputeRooms({
              floor: nextState.floor,
              nodes: nextState.nodes,
              walls: adjustedWalls,
              rooms: nextState.rooms,
            });
          }
          floorState = nextState;
        }
        seededFloors.push(floorState);
      }
      this.floorsState.set(seededFloors);
      const activeId = seededFloors[0]?.floor.id ?? '';
      this.activeFloorId.set(activeId);
      this.reseedIdentifiersFromFloors(seededFloors);
    }
    const created: EditorElement[] = [];
    if (template.elements && template.elements.length) {
      for (const config of template.elements) {
        const { type: elementType, position, ...overrides } = config;
        const tool = this.findToolByType(elementType);
        if (!tool) {
          continue;
        }
        const element = this.instantiateElement(tool, position, 'preset', overrides);
        created.push(element);
      }
    }
    this.elements.set(created);
    this.selectedElementId.set(created.length > 0 ? created[0].id : null);
    this.selectedToolId.set('select');
    this.onboardingDismissed.set(true);
    this.onboardingVisible.set(false);
    this.renderPlan();
  }

  dismissOnboarding() {
    if (!this.isSingleUserMode) {
      return;
    }
    this.onboardingDismissed.set(true);
    this.onboardingVisible.set(false);
  }

  openOnboarding() {
    if (!this.isSingleUserMode) {
      return;
    }
    this.onboardingVisible.set(true);
  }

  setWallResizeMode(mode: 'both' | 'start' | 'end') {
    this.wallResizeMode.set(mode);
  }

  updateSelectedWallLength(value: number) {
    if (!this.isSingleUserMode) {
      return;
    }
    const wallId = this.selectedWallId();
    const activeFloor = this.activeFloorState();
    if (!wallId || !activeFloor) {
      return;
    }
    const mode = this.wallResizeMode();
    const target = Number(value);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }
    const wall = activeFloor.walls.find((candidate) => candidate.id === wallId);
    if (!wall) {
      return;
    }
    const currentLength = this.getWallLength(wall);
    if (Math.abs(currentLength - target) < 1e-3) {
      return;
    }
    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) =>
        state.floor.id === activeFloor.floor.id
          ? this.resizeWallLength(state, wallId, target, mode)
          : state
      )
    );
    this.renderPlan();
  }

  updateSelectedWallThickness(value: number) {
    if (!this.isSingleUserMode) {
      return;
    }
    const wallId = this.selectedWallId();
    const activeFloor = this.activeFloorState();
    if (!wallId || !activeFloor) {
      return;
    }
    const target = Number(value);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }
    const wall = activeFloor.walls.find((candidate) => candidate.id === wallId);
    if (!wall) {
      return;
    }
    const sanitized = Math.max(target, 0.05);
    if (Math.abs(wall.thickness - sanitized) < 1e-4) {
      return;
    }
    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) =>
        state.floor.id === activeFloor.floor.id
          ? this.updateWallThicknessValue(state, wallId, target)
          : state
      )
    );
    this.renderPlan();
  }

  updateSelectedWallHeight(value: number) {
    if (!this.isSingleUserMode) {
      return;
    }
    const wallId = this.selectedWallId();
    const activeFloor = this.activeFloorState();
    if (!wallId || !activeFloor) {
      return;
    }
    const target = Number(value);
    if (!Number.isFinite(target) || target <= 0) {
      return;
    }
    const wall = activeFloor.walls.find((candidate) => candidate.id === wallId);
    if (!wall) {
      return;
    }
    const sanitized = Math.max(target, 0.5);
    if (Math.abs(wall.height - sanitized) < 1e-3) {
      return;
    }
    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) =>
        state.floor.id === activeFloor.floor.id
          ? this.updateWallHeightValue(state, wallId, target)
          : state
      )
    );
    this.renderPlan();
  }

  cycleSelectedRoomType(direction: 'next' | 'prev') {
    if (!this.isSingleUserMode) {
      return;
    }
    const room = this.selectedRoom();
    const activeFloor = this.activeFloorState();
    if (!room || !activeFloor || !this.roomTypePresets.length) {
      return;
    }
    const step = direction === 'next' ? 1 : -1;
    const current = room.roomType ?? '';
    let index = this.roomTypePresets.findIndex((candidate) => candidate.toLowerCase() === current.toLowerCase());
    if (index === -1 && direction === 'prev') {
      index = 0;
    }
    const nextIndex = (index + step + this.roomTypePresets.length) % this.roomTypePresets.length;
    const nextType = this.roomTypePresets[nextIndex];
    this.updateSelectedRoomType(nextType);
  }

  updateSelectedRoomType(value: string) {
    if (!this.isSingleUserMode) {
      return;
    }
    const roomId = this.selectedRoomId();
   const activeFloor = this.activeFloorState();
   if (!roomId || !activeFloor) {
     return;
   }
    const room = activeFloor.rooms.find((candidate) => candidate.id === roomId);
    if (!room) {
      return;
    }
    const trimmed = value.trim();
    const current = room.roomType ?? '';
    if (current === (trimmed || '')) {
      return;
    }
    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) => {
        if (state.floor.id !== activeFloor.floor.id) {
          return state;
        }
        const rooms = state.rooms.map((room) =>
          room.id === roomId ? { ...room, roomType: trimmed || undefined } : room
        );
        return {
          floor: { ...state.floor, updatedAt: Date.now() },
          nodes: state.nodes.map((node) => ({ ...node, wallIds: [...node.wallIds] })),
          walls: state.walls.map((wall) => ({ ...wall })),
          rooms,
        };
      })
    );
    this.renderPlan();
  }

  addFloor() {
    const currentFloors = this.floorsState();
    const baseElevation = this.activeFloorState()?.floor.elevation ?? 0;
    const newFloor = this.createFloorState(`Floor ${currentFloors.length + 1}`, baseElevation + 3);
    this.pushHistorySnapshot();
    this.floorsState.set([...currentFloors, newFloor]);
    this.activeFloorId.set(newFloor.floor.id);
    this.renderPlan();
  }

  duplicateActiveFloor() {
    const active = this.activeFloorState();
    if (!active) {
      return;
    }
    const cloned = this.cloneFloorState(active);
    this.pushHistorySnapshot();
    this.floorsState.set([...this.floorsState(), cloned]);
    this.activeFloorId.set(cloned.floor.id);
    this.renderPlan();
  }

  confirmDeleteFloor(floorId: string) {
    if (this.floorsState().length <= 1) {
      return;
    }
    const target = this.floorsState().find((state) => state.floor.id === floorId);
    const label = target?.floor.name ?? 'this floor';
    const shouldDelete =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete ${label}? This will remove all geometry on it.`);
    if (!shouldDelete) {
      return;
    }
    this.deleteFloor(floorId);
  }

  deleteFloor(floorId: string) {
    const floors = this.floorsState();
    if (floors.length <= 1) {
      return;
    }
    const index = floors.findIndex((state) => state.floor.id === floorId);
    if (index === -1) {
      return;
    }
    this.pushHistorySnapshot();
    const nextFloors = floors.filter((state) => state.floor.id !== floorId);
    this.floorsState.set(nextFloors);

    if (!nextFloors.some((state) => state.floor.id === this.activeFloorId())) {
      const fallback = nextFloors[index] ?? nextFloors[index - 1] ?? nextFloors[0] ?? null;
      this.activeFloorId.set(fallback?.floor.id ?? '');
    }

    const remainingWallIds = new Set<string>();
    const remainingRoomIds = new Set<string>();
    nextFloors.forEach((state) => {
      state.walls.forEach((wall) => remainingWallIds.add(wall.id));
      state.rooms.forEach((room) => remainingRoomIds.add(room.id));
    });

    const selectedWallId = this.selectedWallId();
    if (selectedWallId && !remainingWallIds.has(selectedWallId)) {
      this.selectedWallId.set(null);
    }
    const selectedRoomId = this.selectedRoomId();
    if (selectedRoomId && !remainingRoomIds.has(selectedRoomId)) {
      this.selectedRoomId.set(null);
    }

    this.renderPlan();
  }

  deleteActiveFloor() {
    const active = this.activeFloorState();
    if (!active) {
      return;
    }
    this.confirmDeleteFloor(active.floor.id);
  }

  renameFloor(floorId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    this.pushHistorySnapshot();
    this.floorsState.update((floors) =>
      floors.map((state) =>
        state.floor.id === floorId
          ? {
              floor: { ...state.floor, name: trimmed, updatedAt: Date.now() },
              nodes: state.nodes,
              walls: state.walls,
              rooms: state.rooms,
            }
          : state
      )
    );
    if (this.activeFloorId() === floorId) {
      this.renderPlan();
    }
  }

  undo() {
    if (!this.isSingleUserMode || !this.undoStack.length) {
      return;
    }
    const snapshot = this.undoStack.pop();
    if (!snapshot) {
      return;
    }
    const current = this.snapshotFloorsState();
    this.redoStack = [...this.redoStack, current].slice(-this.historyLimit);
    this.applyHistorySnapshot(snapshot);
  }

  redo() {
    if (!this.isSingleUserMode || !this.redoStack.length) {
      return;
    }
    const snapshot = this.redoStack.pop();
    if (!snapshot) {
      return;
    }
    const current = this.snapshotFloorsState();
    this.undoStack = [...this.undoStack, current].slice(-this.historyLimit);
    this.applyHistorySnapshot(snapshot);
  }

  setActiveFloor(id: string) {
    if (this.activeFloorId() === id) {
      return;
    }
    if (this.floorsState().some((state) => state.floor.id === id)) {
      this.activeFloorId.set(id);
      const floor = this.floorsState().find((state) => state.floor.id === id);
      if (floor) {
        if (!floor.walls.some((wall) => wall.id === this.selectedWallId())) {
          this.selectedWallId.set(null);
        }
        if (!floor.rooms.some((room) => room.id === this.selectedRoomId())) {
          this.selectedRoomId.set(null);
        }
      }
      this.renderPlan();
    }
  }

  promptRenameFloor(floorId: string, currentName: string) {
    const next = window.prompt('Rename floor', currentName);
    if (next !== null) {
      this.renameFloor(floorId, next);
    }
  }

  getWallLength(wall: PlanWall) {
    const floor = this.activeFloorState();
    if (!floor) {
      return 0;
    }
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    const { start, end } = this.getWallEndpoints(wall, nodeMap);
    return Math.hypot(end.x - start.x, end.y - start.y);
  }

  getWallOrientation(wall: PlanWall): WallOrientation {
    const floor = this.activeFloorState();
    if (!floor) {
      return 'horizontal';
    }
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    const { start, end } = this.getWallEndpoints(wall, nodeMap);
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    return dx >= dy ? 'horizontal' : 'vertical';
  }

  wallTooltipPosition(wall: PlanWall) {
    const floor = this.activeFloorState();
    if (!floor) {
      return null;
    }
    const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
    const { start, end } = this.getWallEndpoints(wall, nodeMap);
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const canvasPoint = this.worldToCanvas(mid);
    return canvasPoint;
  }

  roomTooltipPosition(room: PlanRoom) {
    if (!room || !room.polygon.length) {
      return null;
    }
    const centroid = room.centroid ?? { x: 0, y: 0 };
    const canvasPoint = this.worldToCanvas(centroid);
    return { x: canvasPoint.x, y: canvasPoint.y - 28 };
  }

  private resetPlanState() {
    this.elements.set([]);
    this.importedAssets.set([]);
    this.selectedElementId.set(null);
    this.selectedToolId.set('select');
    this.lastElementId = 0;
    this.lastAssetId = 0;
    this.elementCounters = {};
    this.selectedWallId.set(null);
    this.selectedRoomId.set(null);
    this.planView.set({ scale: 1, offsetX: 0, offsetY: 0 });
    const defaultFloor = this.createFloorState('Ground Floor', 0);
    this.floorsState.set([defaultFloor]);
    this.activeFloorId.set(defaultFloor.floor.id);
    this.reseedIdentifiersFromFloors([defaultFloor]);
  }

  readonly inspectorTool = computed(() => {
    const element = this.selectedElement();
    if (!element) {
      return null;
    }
    return this.findToolByType(element.type) ?? null;
  });

  private syncSceneElements() {
    if (!this.sceneBundle) {
      return;
    }
    const elements = this.elements();
    const floors = this.floorsState();
    const expectedIds = new Set<string>();
    elements.forEach((el) => expectedIds.add(el.id));
    floors.forEach((floor) => {
      floor.walls.forEach((wall) => expectedIds.add(`wall:${wall.id}`));
    });

    for (const [id, object] of Array.from(this.elementMeshes.entries())) {
      if (!expectedIds.has(id)) {
        this.sceneBundle.scene.remove(object);
        this.disposeObject(object);
        this.elementMeshes.delete(id);
      }
    }

    for (const element of elements) {
      const existing = this.elementMeshes.get(element.id);
      if (existing) {
        this.sceneBundle.scene.remove(existing);
        this.disposeObject(existing);
        this.elementMeshes.delete(element.id);
      }
      const object = this.buildObjectForElement(element);
      if (object) {
        this.sceneBundle.scene.add(object);
        object.userData['kind'] = 'element';
        this.elementMeshes.set(element.id, object);
      }
    }

    for (const floor of floors) {
      const nodeMap = new Map(floor.nodes.map((node) => [node.id, node] as const));
      for (const wall of floor.walls) {
        const object = this.buildObjectForWall(wall, floor.floor, nodeMap);
        if (object) {
          const key = `wall:${wall.id}`;
          const existing = this.elementMeshes.get(key);
          if (existing) {
            this.sceneBundle.scene.remove(existing);
            this.disposeObject(existing);
            this.elementMeshes.delete(key);
          }
          this.sceneBundle.scene.add(object);
          this.elementMeshes.set(key, object);
        }
      }
    }

    this.highlightSelectionInScene();
  }

  private disposeSceneBundle() {
    if (!this.sceneBundle) {
      this.sceneRenderEffect?.destroy();
      this.sceneRenderEffect = undefined;
      return;
    }
    this.sceneRenderEffect?.destroy();
    this.sceneRenderEffect = undefined;
    for (const object of this.elementMeshes.values()) {
      this.sceneBundle.scene.remove(object);
      this.disposeObject(object);
    }
    this.elementMeshes.clear();
    const renderer = this.sceneBundle.renderer as { setAnimationLoop?: (fn: (() => void) | null) => void };
    renderer?.setAnimationLoop?.(null);
    void this.sceneBundle.renderer?.dispose();
    this.sceneBundle = undefined;
  }

  private buildObjectForElement(element: EditorElement) {
    const color = this.colorForType3d(element.type);
    const material = new THREE.MeshStandardMaterial({
      color,
      metalness: element.type === 'gutter' ? 0.45 : 0.15,
      roughness: element.type === 'window' ? 0.25 : 0.7,
      transparent: element.type === 'window',
      opacity: element.type === 'window' ? 0.55 : 1,
    });

    let object: THREE.Object3D | null = null;
    switch (element.type) {
      case 'pillar':
        object = this.buildPillar(element, material);
        break;
      case 'door':
        object = this.buildDoor(element, material);
        break;
      case 'stairs':
        object = this.buildStairs(element, material);
        break;
      case 'balcony':
        object = this.buildBalcony(element, material);
        break;
      case 'rail':
        object = this.buildRail(element, material);
        break;
      case 'gutter':
        object = this.buildGutter(element, material);
        break;
      case 'corridor':
        object = this.buildCorridor(element, material);
        break;
      default:
        object = this.buildBlock(element, material);
        break;
    }

    if (!object) {
      return null;
    }

    object.userData['elementId'] = element.id;
    this.applyTransform(object, element);
    return object;
  }

  private buildBlock(element: EditorElement, material: THREE.Material) {
    const geometry = new THREE.BoxGeometry(element.width, element.height, element.depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildPillar(element: EditorElement, material: THREE.Material) {
    const radiusX = element.width / 2;
    const radiusZ = element.depth / 2;
    if (Math.abs(radiusX - radiusZ) < 0.05) {
      const geometry = new THREE.CylinderGeometry(radiusX, radiusX, element.height, 24);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    return this.buildBlock(element, material);
  }

  private buildDoor(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const thickness = Math.max(element.thickness ?? 0.08, 0.06);
    const leafGeometry = new THREE.BoxGeometry(element.width, element.height, thickness);
    const leafMaterial = material.clone();
    leafMaterial.opacity = 0.95;
    leafMaterial.transparent = true;
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.castShadow = true;
    leaf.receiveShadow = true;

    const pivot = new THREE.Group();
    pivot.position.x = -element.width / 2;
    leaf.position.x = element.width / 2;
    pivot.add(leaf);
    pivot.rotation.y = THREE.MathUtils.degToRad(element.angle ?? 0);

    group.add(pivot);

    const lintelGeometry = new THREE.BoxGeometry(element.width, 0.08, thickness * 1.3);
    const lintelMaterial = material.clone();
    lintelMaterial.opacity = 0.35;
    lintelMaterial.transparent = true;
    const lintel = new THREE.Mesh(lintelGeometry, lintelMaterial);
    lintel.position.y = element.height / 2 + 0.04;
    group.add(lintel);

    group.userData['doorPivot'] = pivot;
    return group;
  }

  private buildStairs(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const treads = Math.max(4, Math.round(element.height / 0.18));
    const stepHeight = element.height / treads;
    const stepDepth = element.depth / treads;
    for (let i = 0; i < treads; i += 1) {
      const geometry = new THREE.BoxGeometry(element.width, stepHeight, stepDepth);
      const mesh = new THREE.Mesh(geometry, material.clone());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.y = -element.height / 2 + stepHeight / 2 + i * stepHeight;
      mesh.position.z = -element.depth / 2 + stepDepth / 2 + i * stepDepth;
      group.add(mesh);
    }
    return group;
  }

  private buildBalcony(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(element.width, Math.max(element.thickness ?? 0.18, 0.12), element.depth),
      material
    );
    deck.position.y = -element.height / 2 + (element.thickness ?? 0.18) / 2;
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    const railMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.2 });
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(element.width, Math.max(element.height, 1.0), 0.05),
      railMaterial
    );
    rail.position.y = element.height / 2;
    rail.position.z = -element.depth / 2 + 0.02;
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
    return group;
  }

  private buildCorridor(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const group = new THREE.Group();
    const walkwayHeight = Math.max(element.height, 0.1);
    const walkwayMaterial = material.clone();
    walkwayMaterial.metalness = 0.1;
    walkwayMaterial.roughness = 0.45;
    walkwayMaterial.transparent = true;
    walkwayMaterial.opacity = 0.85;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(element.width, walkwayHeight, element.depth),
      walkwayMaterial
    );
    slab.castShadow = false;
    slab.receiveShadow = true;
    group.add(slab);

    const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.2, roughness: 0.6 });
    const trimThickness = Math.min(0.1, Math.max(element.width * 0.04, 0.05));
    const trimHeight = walkwayHeight;
    const leftTrim = new THREE.Mesh(
      new THREE.BoxGeometry(trimThickness, trimHeight, element.depth),
      trimMaterial
    );
    leftTrim.position.x = -element.width / 2 + trimThickness / 2;
    leftTrim.position.y = 0;
    leftTrim.castShadow = false;
    leftTrim.receiveShadow = true;
    const rightTrim = leftTrim.clone();
    rightTrim.position.x = element.width / 2 - trimThickness / 2;

    group.add(leftTrim, rightTrim);
    return group;
  }

  private buildRail(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const geometry = new THREE.BoxGeometry(element.width, element.height, element.depth);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const balusterMaterial = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.3, roughness: 0.35 });
    const balusterCount = Math.max(2, Math.floor(element.width / 0.2));
    const group = new THREE.Group();
    group.add(mesh);
    for (let i = 0; i <= balusterCount; i += 1) {
      const x = -element.width / 2 + (i / balusterCount) * element.width;
      const baluster = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, element.height, Math.max(element.depth * 0.8, 0.04)),
        balusterMaterial
      );
      baluster.position.x = x;
      baluster.castShadow = true;
      baluster.receiveShadow = true;
      group.add(baluster);
    }
    return group;
  }

  private buildGutter(element: EditorElement, material: THREE.MeshStandardMaterial) {
    const geometry = new THREE.CylinderGeometry(element.depth / 2, element.depth / 2, element.width, 16, 1, true, 0, Math.PI);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotateZ(Math.PI / 2);
    mesh.rotateX(THREE.MathUtils.degToRad(element.angle ?? 0));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildObjectForWall(wall: PlanWall, floor: PlanFloor, nodeMap: Map<string, PlanNode>) {
    const startNode = nodeMap.get(wall.startNodeId);
    const endNode = nodeMap.get(wall.endNodeId);
    if (!startNode || !endNode) {
      return null;
    }
    const start = startNode;
    const end = endNode;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) {
      return null;
    }
    const geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness);
    const material = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.1, roughness: 0.6 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    mesh.position.set(centerX, wall.baseElevation + wall.height / 2, -centerY);
    const angle = Math.atan2(dy, dx);
    mesh.rotation.y = -angle;
    mesh.userData['elementId'] = wall.id;
    mesh.userData['kind'] = 'wall';
    return mesh;
  }

  private applyTransform(object: THREE.Object3D, element: EditorElement) {
    const y = element.height / 2;
    object.position.set(element.position.x, y, -element.position.y);
    object.rotation.y = THREE.MathUtils.degToRad(element.rotation ?? 0);
  }

  private highlightSelectionInScene() {
    const selectedElementId = this.selectedElementId();
    const selectedWallId = this.selectedWallId();
    for (const [key, object] of this.elementMeshes) {
      let isSelected = false;
      const kind = object.userData['kind'];
      const elementId = object.userData['elementId'];
      if (kind === 'element') {
        isSelected = elementId === selectedElementId || key === selectedElementId;
      } else if (kind === 'wall') {
        isSelected = elementId === selectedWallId || key === `wall:${selectedWallId}`;
      }
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const material = mesh.material;
          const applyHighlight = (target: THREE.Material) => {
            if ((target as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              const std = target as THREE.MeshStandardMaterial;
              std.emissive = isSelected ? new THREE.Color(0x0ea5e9) : new THREE.Color(0x000000);
              std.emissiveIntensity = isSelected ? 0.35 : 0;
            }
          };
          if (Array.isArray(material)) {
            material.forEach(applyHighlight);
          } else if (material) {
            applyHighlight(material);
          }
        }
      });
    }
  }

  private disposeObject(object: THREE.Object3D) {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat?.dispose();
        }
      }
    });
  }

  ngOnDestroy() {
    this.planRenderEffect?.destroy();
    this.planRenderEffect = undefined;
    this.localPlanEffect?.destroy();
    this.paramSubscription?.unsubscribe();
    this.disposeSceneBundle();
    if (!this.isSingleUserMode) {
      this.cursors.disconnect();
    }
  }

  private randomColor() {
    const colors = ['#f97316', '#22d3ee', '#a855f7', '#facc15'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
