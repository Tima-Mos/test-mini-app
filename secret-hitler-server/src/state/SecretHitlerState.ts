import { Schema, MapSchema, type } from '@colyseus/schema';

export type Phase = 'lobby' | 'setup' | 'roles' | 'election' | 'legislative' | 'veto' | 'executive' | 'end';

export class Player extends Schema {
  @type('string') name: string = '';
  @type('boolean') connected: boolean = true;
  @type('string') role: string = '';
  @type('boolean') alive: boolean = true;
  @type('boolean') ready: boolean = false;
}

export class SecretHitlerState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type('string') phase: Phase = 'lobby';
  @type('number') electionTracker: number = 0;
  @type('number') enactedFascist: number = 0;
  @type('number') enactedLiberal: number = 0;
  @type('string') presidentId: string = '';
  @type('string') chancellorId: string = '';
} 