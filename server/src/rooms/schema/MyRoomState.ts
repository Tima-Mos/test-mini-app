import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("string") nickname: string;
  @type("boolean") ready: boolean = false;
  @type("string") role: string; // Добавляем свойство для роли игрока
  inputQueue: any[] = [];
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") creatorId: string; // ID создателя комнаты
  @type("boolean") gameStarted: boolean = false; // Флаг начала игры
  @type("string") presidentId: string; // ID текущего президента
}
