import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

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
  @type("string") chancellorId: string; // ID текущего канцлера
  @type("string") currentPresidentCandidateId: string; // ID кандидата в президенты
  @type("string") currentChancellorCandidateId: string; // ID кандидата в канцлеры
  @type("number") votesFor: number = 0; // Количество голосов "за"
  @type("number") votesAgainst: number = 0; // Количество голосов "против"
  @type({ map: "boolean" }) votedPlayers = new MapSchema<boolean>(); // Игроки, которые уже проголосовали
  @type("string") currentPhase: string = "waiting"; // Текущая фаза игры (waiting, selectingPresident, selectingChancellor, voting, game, presidentPolicy, chancellorPolicy)
  @type(["string"]) playerOrder = new ArraySchema<string>(); // Порядок игроков для циклического выбора президента
  @type("number") liberalPoliciesEnacted: number = 0; // Количество принятых либеральных законов
  @type("number") fascistPoliciesEnacted: number = 0; // Количество принятых фашистских законов
  @type(["string"]) policyDeck = new ArraySchema<string>(); // Колода законов
  @type(["string"]) discardPile = new ArraySchema<string>(); // Колода сброса
  @type(["string"]) presidentPolicyHand = new ArraySchema<string>(); // Законы, выбранные президентом (3 карты)
  @type(["string"]) chancellorPolicyHand = new ArraySchema<string>(); // Законы, переданные канцлеру (2 карты)
}
