import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';

interface JoinPayload {
  spaceId: string;
  name: string;
  color: string;
}

interface CursorPayload {
  spaceId: string;
  x: number;
  y: number;
}

@WebSocketGateway({ namespace: '/presence', cors: { origin: true, credentials: true } })
export class PresenceGateway {
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() payload: JoinPayload,
    @ConnectedSocket() socket: Socket
  ) {
    socket.join(payload.spaceId);
    socket.data = {
      name: payload.name,
      color: payload.color,
      spaceId: payload.spaceId,
    };
    socket.to(payload.spaceId).emit('user:joined', {
      id: socket.id,
      name: payload.name,
      color: payload.color,
    });
  }

  @SubscribeMessage('cursor')
  handleCursor(
    @MessageBody() payload: CursorPayload,
    @ConnectedSocket() socket: Socket
  ) {
    if (socket.data?.spaceId !== payload.spaceId) return;
    socket.to(payload.spaceId).emit('cursor', {
      id: socket.id,
      name: socket.data.name,
      color: socket.data.color,
      x: payload.x,
      y: payload.y,
      t: Date.now(),
    });
  }

  handleDisconnect(socket: Socket) {
    if (socket.data?.spaceId) {
      socket.to(socket.data.spaceId).emit('user:left', { id: socket.id });
    }
  }
}
