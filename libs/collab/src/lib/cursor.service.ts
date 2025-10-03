import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

export interface RemoteCursor {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class CursorService {
  private socket?: Socket;
  private readonly cursorsSubject = new BehaviorSubject<Record<string, RemoteCursor>>({});
  readonly cursors$ = this.cursorsSubject.asObservable();

  connect(spaceId: string, name: string, color: string) {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.socket = io('/presence', { withCredentials: true });
    this.socket.emit('join', { spaceId, name, color });
    this.socket.on('cursor', (payload: RemoteCursor) => {
      this.cursorsSubject.next({
        ...this.cursorsSubject.value,
        [payload.id]: { ...payload, updatedAt: Date.now() },
      });
    });
    this.socket.on('user:left', ({ id }: { id: string }) => {
      const next = { ...this.cursorsSubject.value };
      delete next[id];
      this.cursorsSubject.next(next);
    });
  }

  send(spaceId: string, x: number, y: number) {
    this.socket?.emit('cursor', { spaceId, x, y });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
    this.cursorsSubject.next({});
  }
}
