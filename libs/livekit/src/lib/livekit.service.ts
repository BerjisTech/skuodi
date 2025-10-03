import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Room, RoomOptions, RoomConnectOptions, createLocalTracks } from 'livekit-client';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LivekitClientService implements OnDestroy {
  private readonly http = inject(HttpClient);
  room?: Room;

  async join(spaceId: string, options?: { audio?: boolean; video?: boolean; roomSuffix?: string }) {
    const response = await firstValueFrom(
      this.http.post<{ url: string; token: string }>(`/rtc/token`, {
        spaceId,
        roomSuffix: options?.roomSuffix,
      })
    );
    const { url, token } = response ?? {};
    if (!url || !token) {
      throw new Error('Missing LiveKit connection details');
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
    } satisfies RoomOptions);

    const connectOptions: RoomConnectOptions = { autoSubscribe: true };
    await room.connect(url, token, connectOptions);

    const audioEnabled = options?.audio ?? true;
    const videoEnabled = options?.video ?? false;
    if (audioEnabled || videoEnabled) {
      const tracks = await createLocalTracks({
        audio: audioEnabled,
        video: videoEnabled,
      });
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track);
      }
    }
    this.room = room;
    return room;
  }

  async leave() {
    await this.room?.disconnect();
    this.room = undefined;
  }

  ngOnDestroy() {
    void this.leave();
  }
}
