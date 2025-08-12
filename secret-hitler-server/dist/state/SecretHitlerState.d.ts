import { Schema, MapSchema } from '@colyseus/schema';
export type Phase = 'lobby' | 'setup' | 'roles' | 'election' | 'legislative' | 'veto' | 'executive' | 'end';
export declare class Player extends Schema {
    name: string;
    connected: boolean;
    role: string;
    alive: boolean;
    ready: boolean;
}
export declare class SecretHitlerState extends Schema {
    players: MapSchema<Player, string>;
    phase: Phase;
    electionTracker: number;
    enactedFascist: number;
    enactedLiberal: number;
    presidentId: string;
    chancellorId: string;
}
//# sourceMappingURL=SecretHitlerState.d.ts.map