import { Inject, Injectable } from '@nestjs/common';
import { AccessToken } from 'livekit-server-sdk';
import { APP_ENV_TOKEN, EnvVars } from '../../config';

@Injectable()
export class LivekitService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly wsUrl: string;

  constructor(@Inject(APP_ENV_TOKEN) env: EnvVars) {
    this.apiKey = env.LIVEKIT_API_KEY;
    this.apiSecret = env.LIVEKIT_API_SECRET;
    this.wsUrl = env.LIVEKIT_WS_URL;
  }

  createJoinToken(params: {
    identity: string;
    name: string;
    room: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
  }) {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: params.identity,
      name: params.name,
    });
    token.addGrant({
      room: params.room,
      roomJoin: true,
      canPublish: params.canPublish ?? true,
      canSubscribe: params.canSubscribe ?? true,
    });
    return token.toJwt();
  }

  get websocketUrl(): string {
    return this.wsUrl;
  }
}
