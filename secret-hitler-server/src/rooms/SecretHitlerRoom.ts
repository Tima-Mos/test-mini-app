import { Client, Room } from '@colyseus/core';
import { Player, SecretHitlerState } from '../state/SecretHitlerState';

export class SecretHitlerRoom extends Room<SecretHitlerState> {
  maxClients = 10;
  state = new SecretHitlerState();

  onCreate(): void {
    this.setPatchRate(50);

    this.onMessage('set-name', (client, name: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.name = (name || '').slice(0, 32);
    });

    this.onMessage('ready', (client, ready: boolean) => {
      const player = this.state.players.get(client.sessionId);
      if (player) player.ready = !!ready;
      // Simple auto-start when 5-10 players ready
      const numPlayers = this.state.players.size;
      const allReady = Array.from(this.state.players.values()).every(p => p.ready && p.connected);
      if (this.state.phase === 'lobby' && numPlayers >= 5 && numPlayers <= 10 && allReady) {
        this.startGame();
      }
    });

    this.onMessage('vote', (client, vote: 'ja' | 'nein') => {
      // Placeholder: implement vote accumulation & progression
      console.log(client.sessionId, 'vote', vote);
    });
  }

  onJoin(client: Client): void {
    const player = new Player();
    player.name = `Player ${this.clients.length}`;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;

    try {
      if (consented) throw new Error('consented');
      await this.allowReconnection(client, 20);
      if (player) player.connected = true;
    } catch {
      this.state.players.delete(client.sessionId);
    }
  }

  private startGame() {
    this.state.phase = 'setup';
    // Role assignment placeholder
    const ids = Array.from(this.state.players.keys());
    if (ids.length < 5) return;
    // Randomly assign roles for prototype
    const fascistsNeeded = ids.length === 5 ? 1 : ids.length <= 6 ? 1 : ids.length <= 8 ? 2 : 3;
    const shuffled = ids.sort(() => Math.random() - 0.5);
    const fascists = new Set(shuffled.slice(0, fascistsNeeded));
    shuffled.forEach((id, idx) => {
      const p = this.state.players.get(id);
      if (!p) return;
      if (fascists.has(id)) p.role = 'fascist';
      else if (idx === fascistsNeeded) p.role = 'hitler';
      else p.role = 'liberal';
    });

    this.state.phase = 'election';
  }
} 