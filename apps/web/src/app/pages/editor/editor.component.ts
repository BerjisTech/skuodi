import { AsyncPipe, KeyValuePipe, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { ProjectsService } from '../../core/services/projects.service';
import { SpacesService } from '../../core/services/spaces.service';
import { CursorService } from '@kouru/collab';
import { buildWallMeshes } from '@kouru/geometry';
import { createScene, resizeRenderer, animate, extrudePolygon, addGrid } from '@kouru/three';

@Component({
  standalone: true,
  selector: 'app-project-editor',
  imports: [AsyncPipe, NgIf, NgFor, RouterLink, KeyValuePipe],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
})
export class EditorComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly projects = inject(ProjectsService);
  private readonly spaces = inject(SpacesService);
  private readonly cursors = inject(CursorService);

  readonly projectId$ = this.route.paramMap.pipe(map((params) => params.get('projectId') ?? ''));
  readonly spaceId$ = this.route.paramMap.pipe(map((params) => params.get('spaceId') ?? ''));

  readonly project$ = this.projectId$.pipe(switchMap((id) => this.projects.get(id)));
  readonly members$ = this.spaceId$.pipe(switchMap((id) => this.spaces.listMembers(id)));
  readonly cursors$ = this.cursors.cursors$;

  readonly status = signal('idle');

  @ViewChild('planCanvas', { static: false }) planCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sceneCanvas', { static: false }) sceneCanvas?: ElementRef<HTMLCanvasElement>;

  private sceneBundle?: ReturnType<typeof createScene>;

  ngOnInit() {
    combineLatest([this.projectId$, this.spaceId$]).subscribe(([projectId, spaceId]) => {
      if (spaceId) {
        const color = this.randomColor();
        this.cursors.connect(spaceId, 'You', color);
      }
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
    const canvas = this.sceneCanvas?.nativeElement;
    if (!canvas) return;
    this.sceneBundle = createScene(canvas);
    addGrid(this.sceneBundle.scene);
    animate(this.sceneBundle, () => resizeRenderer(this.sceneBundle!));
    this.bootstrapDemoGeometry();
  }

  private bootstrapDemoGeometry() {
    if (!this.sceneBundle) return;
    const meshes = buildWallMeshes([
      { start: [0, 0], end: [4, 0], thickness: 0.2, height: 3 },
      { start: [4, 0], end: [4, 3], thickness: 0.2, height: 3 },
      { start: [4, 3], end: [0, 3], thickness: 0.2, height: 3 },
      { start: [0, 3], end: [0, 0], thickness: 0.2, height: 3 },
    ]);
    meshes.forEach((mesh) => {
      const geometry = extrudePolygon(
        Array.from({ length: mesh.positions.length / 2 }, (_, idx) => [mesh.positions[idx * 2], mesh.positions[idx * 2 + 1]] as [number, number]),
        3
      );
      this.sceneBundle?.scene.add(geometry);
    });
  }

  onCanvasPointer(event: PointerEvent) {
    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const spaceId = this.route.snapshot.paramMap.get('spaceId');
    if (spaceId) {
      this.cursors.send(spaceId, x, y);
    }
  }

  ngOnDestroy() {
    this.cursors.disconnect();
    void this.sceneBundle?.renderer?.dispose();
  }

  private randomColor() {
    const colors = ['#f97316', '#22d3ee', '#a855f7', '#facc15'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
