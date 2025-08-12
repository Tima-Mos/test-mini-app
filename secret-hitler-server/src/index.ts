import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SecretHitlerRoom } from './rooms/SecretHitlerRoom';

const PORT = process.env.PORT ? Number(process.env.PORT) : 2567;

async function main() {
  const app = express();
  app.use(cors());
  app.get('/', (_req: Request, res: Response) => res.send('Secret Hitler Server is running'));

  const httpServer = http.createServer(app);
  const transport = new WebSocketTransport({ server: httpServer });
  const gameServer = new Server({ transport });

  gameServer.define('secret_hitler', SecretHitlerRoom).enableRealtimeListing();

  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
  console.log(`Colyseus listening on ws://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 