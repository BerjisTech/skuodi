import { AsyncPipe, DatePipe, DecimalPipe, KeyValuePipe, NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
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

@Component({
  standalone: true,
  selector: 'app-project-editor',
  imports: [AsyncPipe, NgIf, NgFor, RouterLink, KeyValuePipe, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
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
            defaults: { width: 4, depth: 0.25, height: 3, thickness: 0.25 },
            editable: ['width', 'height', 'thickness'],
          },
          {
            id: 'corridor',
            type: 'corridor',
            label: 'Corridor',
            description: 'Define a hallway or circulation zone.',
            icon: '➖',
            defaults: { width: 3, depth: 1.6, height: 0.2 },
            editable: ['width', 'depth'],
          },
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

  readonly selectedToolId = signal<string>('select');
  readonly elements = signal<EditorElement[]>([]);
  readonly selectedElementId = signal<string | null>(null);
  readonly selectedElement = computed(() =>
    this.elements().find((el) => el.id === this.selectedElementId()) ?? null
  );
  readonly importedAssets = signal<ImportedAsset[]>([]);
  readonly localCursor = signal<{ x: number; y: number; label: string; color: string } | null>(null);
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

  private planContext?: CanvasRenderingContext2D;
  private planRenderEffect?: EffectRef;
  private sceneRenderEffect?: EffectRef;
  private dragState?: { elementId: string; offset: { x: number; y: number } };
  private lastElementId = 0;
  private localCursorColor = '#f97316';
  private currentSpaceId: string | null = null;
  private paramSubscription?: Subscription;
  private elementCounters: Partial<Record<EditorElementType, number>> = {};
  private lastAssetId = 0;
  private elementMeshes = new Map<string, THREE.Object3D>();

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

  @ViewChild('planCanvas', { static: false }) planCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sceneCanvas', { static: false }) sceneCanvas?: ElementRef<HTMLCanvasElement>;

  private sceneBundle?: ReturnType<typeof createScene>;

  ngOnInit() {
    if (this.isSingleUserMode) {
      this.status.set('ready');
      return;
    }
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

  ngAfterViewInit() {
    const planCanvas = this.planCanvas?.nativeElement;
    if (planCanvas) {
      this.preparePlanCanvas(planCanvas);
      this.planRenderEffect = effect(() => {
        this.elements();
        this.selectedElementId();
        this.renderPlan();
      });
    }

    const sceneCanvas = this.sceneCanvas?.nativeElement;
    if (!sceneCanvas) return;
    this.sceneBundle = createScene(sceneCanvas);
    addGrid(this.sceneBundle.scene);
    const bundle = this.sceneBundle;
    if (!bundle) {
      return;
    }
    animate(bundle, () => resizeRenderer(bundle));
    this.sceneRenderEffect = effect(() => {
      this.elements();
      this.selectedElementId();
      this.syncSceneElements();
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
    for (const element of this.elements()) {
      this.drawPlanElement(ctx, element);
    }
    const selected = this.selectedElement();
    if (selected) {
      this.drawSelectionOutline(ctx, selected);
    }
    ctx.restore();
  }

  private drawPlanGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const majorStep = this.pixelsPerMeter;
    const minorStep = majorStep / 2;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

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
    return {
      x: centerX + position.x * this.pixelsPerMeter,
      y: centerY - position.y * this.pixelsPerMeter,
    };
  }

  private canvasToWorld(point: { x: number; y: number }) {
    const canvas = this.planCanvas?.nativeElement;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const worldX = (point.x - centerX) / this.pixelsPerMeter;
    const worldY = (centerY - point.y) / this.pixelsPerMeter;
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

  onPlanPointerMove(event: PointerEvent) {
    const canvasPoint = this.pointerEventToCanvas(event);
    if (!canvasPoint) {
      return;
    }
    const world = this.canvasToWorld(canvasPoint);
    this.updateLocalCursor(canvasPoint.x, canvasPoint.y);
    if (this.currentSpaceId) {
      this.cursors.send(this.currentSpaceId, canvasPoint.x, canvasPoint.y);
    }
    if (this.dragState) {
      this.moveDraggedElement(world);
    }
  }

  onPlanPointerDown(event: PointerEvent) {
    event.preventDefault();
    const canvasPoint = this.pointerEventToCanvas(event);
    if (!canvasPoint) {
      return;
    }
    const world = this.canvasToWorld(canvasPoint);
    const toolId = this.selectedToolId();
    if (toolId !== 'select') {
      const tool = this.findToolById(toolId);
      if (tool && tool.type !== 'select') {
        const element = this.instantiateElement(tool, world, 'tool');
        this.elements.update((items) => [...items, element]);
        this.selectedElementId.set(element.id);
      }
    } else {
      const hit = this.findElementAt(world);
      if (hit) {
        this.selectedElementId.set(hit.id);
        this.dragState = {
          elementId: hit.id,
          offset: { x: world.x - hit.position.x, y: world.y - hit.position.y },
        };
      } else {
        this.selectedElementId.set(null);
      }
    }
    if (event.pointerId && event.target instanceof HTMLElement) {
      event.target.setPointerCapture(event.pointerId);
    }
  }

  onPlanPointerUp(event: PointerEvent) {
    this.dragState = undefined;
    if (event.pointerId && event.target instanceof HTMLElement) {
      event.target.releasePointerCapture(event.pointerId);
    }
  }

  onPlanPointerLeave() {
    this.dragState = undefined;
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
    const expectedIds = new Set(elements.map((el) => el.id));

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
        this.elementMeshes.set(element.id, object);
      }
    }

    this.highlightSelectionInScene();
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

  private applyTransform(object: THREE.Object3D, element: EditorElement) {
    const y = element.height / 2;
    object.position.set(element.position.x, y, -element.position.y);
    object.rotation.y = THREE.MathUtils.degToRad(element.rotation ?? 0);
  }

  private highlightSelectionInScene() {
    const selectedId = this.selectedElementId();
    for (const [id, object] of this.elementMeshes) {
      const isSelected = id === selectedId;
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
    this.sceneRenderEffect?.destroy();
    this.paramSubscription?.unsubscribe();
    for (const object of this.elementMeshes.values()) {
      this.sceneBundle?.scene.remove(object);
      this.disposeObject(object);
    }
    this.elementMeshes.clear();
    if (!this.isSingleUserMode) {
      this.cursors.disconnect();
    }
    void this.sceneBundle?.renderer?.dispose();
  }

  private randomColor() {
    const colors = ['#f97316', '#22d3ee', '#a855f7', '#facc15'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
