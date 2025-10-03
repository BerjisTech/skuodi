import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { SpacesService } from '../../core/services/spaces.service';
import { ProjectsService } from '../../core/services/projects.service';
import { LivekitClientService } from '@kouru/livekit';

@Component({
  standalone: true,
  selector: 'app-space-detail',
  imports: [AsyncPipe, NgFor, NgIf, RouterLink, DatePipe],
  templateUrl: './space-detail.component.html',
})
export class SpaceDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly spaces = inject(SpacesService);
  private readonly projects = inject(ProjectsService);
  readonly livekit = inject(LivekitClientService);

  readonly joining = signal(false);
  readonly callError = signal<string | null>(null);

  readonly spaceId$ = this.route.paramMap.pipe(map((params) => params.get('spaceId') ?? ''));

  readonly space$ = combineLatest([this.spaceId$, this.spaces.spaces$]).pipe(
    map(([spaceId, spaces]) => spaces?.find((space) => space.id === spaceId))
  );

  readonly members$ = this.spaceId$.pipe(
    switchMap((spaceId) => this.spaces.listMembers(spaceId))
  );

  readonly projects$ = this.spaceId$.pipe(switchMap((spaceId) => this.projects.list(spaceId)));

  ngOnInit() {
    this.spaceId$.pipe(switchMap(() => this.spaces.loadSpaces())).subscribe();
  }

  async joinCall() {
    const spaceId = this.route.snapshot.paramMap.get('spaceId');
    if (!spaceId) {
      return;
    }
    this.joining.set(true);
    this.callError.set(null);
    try {
      await this.livekit.join(spaceId, { audio: true });
    } catch (error) {
      console.error(error);
      this.callError.set('Unable to join LiveKit room.');
    } finally {
      this.joining.set(false);
    }
  }

  async leaveCall() {
    await this.livekit.leave();
  }

  ngOnDestroy() {
    void this.livekit.leave();
  }
}
