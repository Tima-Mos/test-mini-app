import { Client, Room } from '@colyseus/core';
import { SecretHitlerState } from '../state/SecretHitlerState';
export declare class SecretHitlerRoom extends Room<SecretHitlerState> {
    maxClients: number;
    state: SecretHitlerState;
    onCreate(): void;
    onJoin(client: Client): void;
    onLeave(client: Client, consented: boolean): Promise<void>;
    private startGame;
}
//# sourceMappingURL=SecretHitlerRoom.d.ts.map