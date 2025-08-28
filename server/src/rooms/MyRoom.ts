import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 10;
  state = new MyRoomState();

  onCreate(options: any) {
    // Сохраняем имя комнаты в метаданных
    if (options.name) {
      this.setMetadata({ name: options.name });
    }

    // Обработчик сообщений для управления движением (когда игра начнется)
    this.onMessage("move", (client, payload) => {
      if (!this.state.gameStarted) return; // Движение только после начала игры

      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.inputQueue.push(payload);
      }
    });

    // Обработчик смены статуса готовности
    this.onMessage("toggle-ready", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = !player.ready;
        console.log(`Player ${player.nickname} is now ${player.ready ? 'ready' : 'not ready'}`);

        // Проверяем, все ли игроки готовы
        this.checkAllPlayersReady();
      }
    });

    // Обработчик начала игры (только для создателя)
    this.onMessage("start-game", (client) => {
      if (client.sessionId === this.state.creatorId) {
        const allReady = Array.from(this.state.players.values()).every(player => player.ready);
        if (allReady && this.state.players.size > 0) {
          this.state.gameStarted = true;


          this.broadcast("game-started");

          // Задержка перед распределением ролей, чтобы клиенты успели инициализировать обработчики
          this.clock.setTimeout(() => {
            // Распределение ролей
            this.assignRoles();

            // Задержка перед выбором президента
            this.clock.setTimeout(() => {
              this.selectPresident();
            }, 5000); // 5 секунд задержки

          }, 1000); // 1 секунда задержки

          console.log("Game started by creator!");
        }
      }
    });

    // Запускаем игровой цикл только когда игра началась
    this.setSimulationInterval((deltaTime) => {
      if (this.state.gameStarted) {
        this.update(deltaTime);
      }
    });
  }

  update(deltaTime: number) {
    const velocity = 2;

    this.state.players.forEach(player => {
      let input: any;

      // dequeue player inputs
      while (input = player.inputQueue.shift()) {
        if (input.left) {
          player.x -= velocity;
        } else if (input.right) {
          player.x += velocity;
        }

        if (input.up) {
          player.y -= velocity;
        } else if (input.down) {
          player.y += velocity;
        }
      }
    });
  }

  checkAllPlayersReady() {
    const allReady = Array.from(this.state.players.values()).every(player => player.ready);
    if (allReady && this.state.players.size > 0) {
      // Уведомляем создателя, что можно начинать игру
      const creator = this.clients.find(client => client.sessionId === this.state.creatorId);
      if (creator) {
        creator.send("all-players-ready");
      }
    }
  }

  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined with nickname:", options.nickname);

    // Создаем игрока
    const player = new Player();
    player.nickname = options.nickname || `Player_${client.sessionId.substring(0, 4)}`;
    player.ready = false;

    // Если это первый игрок - он становится создателем
    if (this.state.players.size === 0) {
      this.state.creatorId = client.sessionId;
      console.log(`${player.nickname} is now the room creator`);
    }

    // Устанавливаем начальную позицию для игры (будет использоваться когда игра начнется)
    const mapWidth = 800;
    const mapHeight = 600;
    player.x = Math.random() * mapWidth;
    player.y = Math.random() * mapHeight;

    // Добавляем игрока в состояние
    this.state.players.set(client.sessionId, player);

    // Отправляем клиенту информацию о том, является ли он создателем
    client.send("room-joined", {
      isCreator: client.sessionId === this.state.creatorId,
      gameStarted: this.state.gameStarted
    });
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");

    // Удаляем игрока
    this.state.players.delete(client.sessionId);

    // Если ушел создатель, назначаем нового
    if (client.sessionId === this.state.creatorId && this.state.players.size > 0) {
      const newCreatorId = Array.from(this.state.players.keys())[0];
      this.state.creatorId = newCreatorId;

      const newCreator = this.clients.find(c => c.sessionId === newCreatorId);
      if (newCreator) {
        newCreator.send("you-are-creator");
        console.log(`New creator: ${this.state.players.get(newCreatorId)?.nickname}`);
      }
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  // Функция для распределения ролей
  assignRoles() {
    const playerCount = this.state.players.size;
    let liberalCount: number;
    let fascistCount: number;
    const hitlerCount = 1;

    switch (playerCount) {
      case 5:
        liberalCount = 3;
        fascistCount = 1;
        break;
      case 6:
        liberalCount = 4;
        fascistCount = 1;
        break;
      case 7:
        liberalCount = 4;
        fascistCount = 2;
        break;
      case 8:
        liberalCount = 5;
        fascistCount = 2;
        break;
      case 9:
        liberalCount = 5;
        fascistCount = 3;
        break;
      case 10:
        liberalCount = 6;
        fascistCount = 3;
        break;
      default:
        console.error("Invalid player count for role assignment");
        return;
    }

    const roles: string[] = [];
    for (let i = 0; i < liberalCount; i++) roles.push("liberal");
    for (let i = 0; i < fascistCount; i++) roles.push("fascist");
    roles.push("hitler");

    // Перемешиваем роли
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    // Назначаем роли игрокам и отправляем им их роли
    let roleIndex = 0;
    this.state.players.forEach((player, sessionId) => {
      player.role = roles[roleIndex];
      const client = this.clients.find(c => c.sessionId === sessionId);
      if (client) {
        console.log(`Sending role "${player.role}" to player ${player.nickname} (${sessionId})`);
        client.send("your-role", { role: player.role });
      }
      roleIndex++;
    });
  }

  // Функция для выбора президента
  selectPresident() {
    const players = Array.from(this.state.players.keys());
    if (players.length === 0) {
      console.warn("Cannot select president: no players in the room.");
      return;
    }

    const randomIndex = Math.floor(Math.random() * players.length);
    const presidentSessionId = players[randomIndex];
    this.state.presidentId = presidentSessionId;

    const presidentNickname = this.state.players.get(presidentSessionId)?.nickname || "Unknown";
    console.log(`President selected: ${presidentNickname} (${presidentSessionId})`);

    // Отправляем одно широковещательное сообщение всем клиентам
    this.broadcast("president-info", {
      presidentId: presidentSessionId,
      presidentNickname: presidentNickname,
    });
  }
}
