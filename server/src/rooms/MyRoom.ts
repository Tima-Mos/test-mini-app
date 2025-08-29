import { Room, Client } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
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

    // Обработчик выбора канцлера
    this.onMessage("chancellor-selected", (client, payload) => {
      // Проверяем, что отправитель - это текущий президент
      if (client.sessionId === this.state.currentPresidentCandidateId) {
        const selectedChancellorId = payload.chancellorId;
        const selectedChancellor = this.state.players.get(selectedChancellorId);

        if (selectedChancellor) {
          this.state.currentChancellorCandidateId = selectedChancellorId;
          console.log(`President candidate ${this.state.players.get(client.sessionId)?.nickname} selected ${selectedChancellor.nickname} as chancellor candidate.`);

          // Начинаем фазу голосования
          this.startVotingPhase();
        } else {
          console.warn(`President candidate ${this.state.players.get(client.sessionId)?.nickname} tried to select an invalid chancellor ID: ${selectedChancellorId}`);
        }
      } else {
        console.warn(`Client ${client.sessionId} (not president) tried to select a chancellor.`);
      }
    });

    // Обработчик голосования
    this.onMessage("cast-vote", (client, payload) => {
      if (this.state.currentPhase !== "voting") {
        console.warn(`Client ${client.sessionId} tried to vote outside of voting phase.`);
        return;
      }

      if (this.state.votedPlayers.has(client.sessionId)) {
        console.warn(`Client ${client.sessionId} tried to vote multiple times.`);
        return;
      }

      const vote = payload.vote; // "for" or "against"

      if (vote === "for") {
        this.state.votesFor++;
      } else if (vote === "against") {
        this.state.votesAgainst++;
      } else {
        console.warn(`Client ${client.sessionId} cast an invalid vote: ${vote}`);
        return;
      }

      this.state.votedPlayers.set(client.sessionId, true);
      console.log(`Player ${this.state.players.get(client.sessionId)?.nickname} voted ${vote}. Votes for: ${this.state.votesFor}, Votes against: ${this.state.votesAgainst}`);

      // Проверяем, все ли игроки проголосовали
      if (this.state.votedPlayers.size === this.state.players.size) {
        this.endVotingPhase();
      }
    });

    // Обработчик выбора президентом закона для сброса
    this.onMessage("president-discard-policy", (client, payload) => {
      if (client.sessionId !== this.state.presidentId || this.state.currentPhase !== "presidentPolicy") {
        console.warn(`Client ${client.sessionId} tried to discard a policy outside of presidentPolicy phase or not as president.`);
        return;
      }

      const discardedPolicy = payload.policy; // Например, "liberal" или "fascist"
      const policyIndex = this.state.presidentPolicyHand.indexOf(discardedPolicy);

      if (policyIndex > -1) {
        // Удаляем выбранный закон из руки президента и добавляем в колоду сброса
        this.state.discardPile.push(this.state.presidentPolicyHand.splice(policyIndex, 1)[0]);
        console.log(`President ${this.state.players.get(client.sessionId)?.nickname} discarded a ${discardedPolicy} policy.`);

        // Оставшиеся 2 закона передаем канцлеру
        this.state.chancellorPolicyHand.clear();
        this.state.chancellorPolicyHand.push(...this.state.presidentPolicyHand.toArray());
        this.state.presidentPolicyHand.clear();

        const chancellorClient = this.clients.find(c => c.sessionId === this.state.chancellorId);
        if (chancellorClient) {
          chancellorClient.send("chancellor-select-policy", { policies: this.state.chancellorPolicyHand.toArray() });
          this.state.currentPhase = "chancellorPolicy";
          console.log(`Policies passed to Chancellor ${this.state.players.get(this.state.chancellorId)?.nickname}.`);
        }
      } else {
        console.warn(`President ${this.state.players.get(client.sessionId)?.nickname} tried to discard an invalid policy: ${discardedPolicy}`);
      }
    });

    // Обработчик выбора канцлером закона для принятия
    this.onMessage("chancellor-play-policy", (client, payload) => {
      if (client.sessionId !== this.state.chancellorId || this.state.currentPhase !== "chancellorPolicy") {
        console.warn(`Client ${client.sessionId} tried to play a policy outside of chancellorPolicy phase or not as chancellor.`);
        return;
      }

      const playedPolicy = payload.policy;
      const policyIndex = this.state.chancellorPolicyHand.indexOf(playedPolicy);

      if (policyIndex > -1) {
        // Удаляем выбранный закон из руки канцлера и кладем на соответствующую доску
        this.state.chancellorPolicyHand.splice(policyIndex, 1);

        if (playedPolicy === "liberal") {
          this.state.liberalPoliciesEnacted++;
        } else if (playedPolicy === "fascist") {
          this.state.fascistPoliciesEnacted++;
        }
        console.log(`Chancellor ${this.state.players.get(client.sessionId)?.nickname} played a ${playedPolicy} policy.`);

        // Оставшийся закон из руки канцлера отправляем в колоду сброса
        if (this.state.chancellorPolicyHand.length > 0) {
          this.state.discardPile.push(this.state.chancellorPolicyHand.shift());
        }
        this.state.chancellorPolicyHand.clear();

        // Отправляем всем клиентам информацию о принятом законе
        this.broadcast("policy-played", {
          policyType: playedPolicy,
          liberalPolicies: this.state.liberalPoliciesEnacted,
          fascistPolicies: this.state.fascistPoliciesEnacted,
        });

        // Переходим к следующему раунду или фазе игры
        this.state.currentPhase = "gamePlay"; // Или другая следующая фаза
        // Проверка на фазу убийства
        if (playedPolicy === "fascist" && (this.state.fascistPoliciesEnacted === 4 || this.state.fascistPoliciesEnacted === 5)) {
          this.startAssassinationPhase();
        } else {
          const gameOver = this.checkWinConditions();
          if (!gameOver) {
            this.clock.setTimeout(() => {
              this.selectNextPresident();
              this.selectPresident();
            }, 5000);
          }
        }
      } else {
        console.warn(`Chancellor ${this.state.players.get(client.sessionId)?.nickname} tried to play an invalid policy: ${playedPolicy}`);
      }
    });

    // Обработчик убийства игрока президентом
    this.onMessage("president-assassinate-player", (client, payload) => {
      if (client.sessionId !== this.state.presidentId || this.state.currentPhase !== "assassination") {
        console.warn(`Client ${client.sessionId} tried to assassinate a player outside of assassination phase or not as president.`);
        return;
      }

      const targetPlayerId = payload.targetId;
      const targetPlayer = this.state.players.get(targetPlayerId);

      if (targetPlayer && !targetPlayer.isEliminated) {
        targetPlayer.isEliminated = true;
        console.log(`President ${this.state.players.get(client.sessionId)?.nickname} assassinated ${targetPlayer.nickname}.`);

        // Удаляем игрока из порядка выбора президента
        const playerIndex = this.state.playerOrder.indexOf(targetPlayerId);
        if (playerIndex > -1) {
          this.state.playerOrder.splice(playerIndex, 1);
        }

        // Отправляем всем клиентам информацию об убитом игроке
        this.broadcast("player-eliminated", { eliminatedPlayerId: targetPlayerId, message: `${targetPlayer.nickname} was assassinated!` });

        // Проверяем условия победы после убийства
        const gameOver = this.checkWinConditions();

        // Если игра не закончилась, переходим к следующему раунду выборов президента
        if (!gameOver) {
          this.clock.setTimeout(() => {
            this.selectNextPresident();
            this.selectPresident();
          }, 5000);
        }
      } else {
        console.warn(`President ${this.state.players.get(client.sessionId)?.nickname} tried to assassinate an invalid or already eliminated player: ${targetPlayerId}`);
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

            // Инициализация порядка игроков для циклического выбора президента
            this.state.playerOrder.clear();
            Array.from(this.state.players.keys()).forEach(sessionId => this.state.playerOrder.push(sessionId));

            // Задержка перед выбором президента
            this.clock.setTimeout(() => {
              this.selectPresident();
            }, 5000); // 5 секунд задержки

            // Инициализация колоды законов
            this.initializePolicyDeck();
            console.log(`Policy deck initialized with ${this.state.policyDeck.length} policies.`);

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
    if (this.state.playerOrder.length === 0) {
      console.warn("Cannot select president: no players in playerOrder.");
      return;
    }

    // Фильтруем выбывших игроков из playerOrder
    const activePlayerOrder = this.state.playerOrder.filter(sessionId => !this.state.players.get(sessionId)?.isEliminated);

    if (activePlayerOrder.length === 0) {
      console.warn("Cannot select president: no active players left.");
      // Здесь можно добавить логику для завершения игры, если не осталось активных игроков
      return;
    }

    // Выбираем президента по циклу из activePlayerOrder
    let currentPresidentIndex = -1;
    if (this.state.currentPresidentCandidateId) {
      currentPresidentIndex = activePlayerOrder.indexOf(this.state.currentPresidentCandidateId);
    }

    let nextPresidentIndex = (currentPresidentIndex + 1) % activePlayerOrder.length;
    let presidentSessionId = activePlayerOrder[nextPresidentIndex];

    // Если выбранный президент выбыл, ищем следующего активного
    let attempts = 0;
    while (this.state.players.get(presidentSessionId)?.isEliminated && attempts < activePlayerOrder.length) {
      nextPresidentIndex = (nextPresidentIndex + 1) % activePlayerOrder.length;
      presidentSessionId = activePlayerOrder[nextPresidentIndex];
      attempts++;
    }

    // Если все игроки выбыли или что-то пошло не так (по идее не должно быть достигнуто, если activePlayerOrder.length === 0 обработан выше)
    if (this.state.players.get(presidentSessionId)?.isEliminated) {
      console.warn("No eligible president found after filtering eliminated players.");
      // Дополнительная логика обработки ситуации, когда не удалось найти президента
      return;
    }

    this.state.currentPresidentCandidateId = presidentSessionId; // Устанавливаем кандидата в президенты

    const presidentNickname = this.state.players.get(presidentSessionId)?.nickname || "Unknown";
    console.log(`President candidate selected: ${presidentNickname} (${presidentSessionId})`);

    // Отправляем одно широковещательное сообщение всем клиентам о кандидате в президенты
    this.broadcast("president-candidate-info", {
      presidentCandidateId: presidentSessionId,
      presidentCandidateNickname: presidentNickname,
    });

    // Отправляем сообщение только кандидату в президенты для выбора канцлера
    const presidentClient = this.clients.find(c => c.sessionId === presidentSessionId);
    if (presidentClient) {
      const otherPlayers = Array.from(this.state.players.entries())
        .filter(([sessionId, player]) => sessionId !== presidentSessionId && !player.isEliminated)
        .map(([sessionId, player]) => ({ sessionId: sessionId, nickname: player.nickname }));
      presidentClient.send("select-chancellor", { players: otherPlayers });
      this.state.currentPhase = "selectingChancellor";
      console.log(`President candidate ${presidentNickname} (${presidentSessionId}) is now selecting a chancellor.`);
    }
  }

  // Функция для циклического выбора следующего президента
  selectNextPresident() {
    // Фильтруем выбывших игроков из playerOrder
    const activePlayerOrder = this.state.playerOrder.filter(sessionId => !this.state.players.get(sessionId)?.isEliminated);

    if (activePlayerOrder.length === 0) {
      console.warn("Cannot select next president: no active players left.");
      // Здесь можно добавить логику для завершения игры, если не осталось активных игроков
      return;
    }

    // Если текущего президента еще нет, выбираем первого из активного списка
    if (!this.state.currentPresidentCandidateId) {
      this.state.currentPresidentCandidateId = activePlayerOrder[0];
      const presidentNickname = this.state.players.get(this.state.currentPresidentCandidateId)?.nickname || "Unknown";
      console.log(`Next president candidate selected (initial): ${presidentNickname} (${this.state.currentPresidentCandidateId})`);
      return;
    }

    let currentPresidentIndex = activePlayerOrder.indexOf(this.state.currentPresidentCandidateId);
    let nextPresidentIndex = (currentPresidentIndex + 1) % activePlayerOrder.length;
    let newPresidentCandidateId = activePlayerOrder[nextPresidentIndex];

    // Если выбранный президент выбыл, ищем следующего активного
    let attempts = 0;
    while (this.state.players.get(newPresidentCandidateId)?.isEliminated && attempts < activePlayerOrder.length) {
      nextPresidentIndex = (nextPresidentIndex + 1) % activePlayerOrder.length;
      newPresidentCandidateId = activePlayerOrder[nextPresidentIndex];
      attempts++;
    }

    // Если все игроки выбыли или что-то пошло не так (по идее не должно быть достигнуто, если activePlayerOrder.length === 0 обработан выше)
    if (this.state.players.get(newPresidentCandidateId)?.isEliminated) {
      console.warn("No eligible next president found after filtering eliminated players.");
      // Дополнительная логика обработки ситуации, когда не удалось найти президента
      return;
    }

    this.state.currentPresidentCandidateId = newPresidentCandidateId;
    const presidentNickname = this.state.players.get(newPresidentCandidateId)?.nickname || "Unknown";
    console.log(`Next president candidate selected: ${presidentNickname} (${newPresidentCandidateId})`);
  }

  // Функция для начала фазы голосования
  startVotingPhase() {
    this.state.currentPhase = "voting";
    this.state.votesFor = 0;
    this.state.votesAgainst = 0;
    this.state.votedPlayers.clear();

    // Отправляем всем клиентам сообщение о начале голосования
    this.broadcast("start-vote", {
      presidentCandidateId: this.state.currentPresidentCandidateId,
      presidentCandidateNickname: this.state.players.get(this.state.currentPresidentCandidateId)?.nickname,
      chancellorCandidateId: this.state.currentChancellorCandidateId,
      chancellorCandidateNickname: this.state.players.get(this.state.currentChancellorCandidateId)?.nickname,
    });
    console.log("Voting phase started.");
  }

  // Функция для завершения фазы голосования
  endVotingPhase() {
    this.state.currentPhase = "voting-results";
    const presidentNickname = this.state.players.get(this.state.currentPresidentCandidateId)?.nickname || "Unknown";
    const chancellorNickname = this.state.players.get(this.state.currentChancellorCandidateId)?.nickname || "Unknown";

    // Определяем победителя
    let votePassed = this.state.votesFor > this.state.players.size / 2;

    let resultMessage = "";
    if (votePassed) {
      this.state.presidentId = this.state.currentPresidentCandidateId;
      this.state.chancellorId = this.state.currentChancellorCandidateId;
      resultMessage = `Vote PASSED! ${presidentNickname} is President and ${chancellorNickname} is Chancellor.`;
    } else {
      this.selectNextPresident(); // Выбираем следующего президента
      resultMessage = `Vote FAILED! New president will be selected.`;
    }

    // Отправляем результаты голосования всем клиентам
    this.broadcast("voting-results", {
      presidentCandidateId: this.state.currentPresidentCandidateId,
      presidentCandidateNickname: presidentNickname,
      chancellorCandidateId: this.state.currentChancellorCandidateId,
      chancellorCandidateNickname: chancellorNickname,
      votePassed: votePassed,
      votesFor: this.state.votesFor,
      votesAgainst: this.state.votesAgainst,
      message: resultMessage
    });
    console.log(resultMessage);

    // Очищаем голоса и голосовавших
    this.state.votesFor = 0;
    this.state.votesAgainst = 0;
    this.state.votedPlayers.clear();

    if (!votePassed) {
      // Если голосование провалилось, снова запускаем процесс выбора президента/канцлера
      this.clock.setTimeout(() => {
        this.selectPresident(); // Начинаем новый раунд выбора президента и канцлера
      }, 5000); // Задержка перед началом нового раунда
    } else {
      // Если голосование прошло, игра продолжается с назначенными президентом и канцлером
      // Здесь можно добавить логику для следующего шага игры (например, раздача карт)
      this.state.currentPhase = "gamePlay"; // Или другая следующая фаза
      console.log("Government successfully elected. Proceeding to policy phase.");
      this.clock.setTimeout(() => {
        this.startPolicyPhase();
      }, 3000); // Задержка перед началом фазы политики
    }
  }

  // Функция для начала фазы принятия законов
  startPolicyPhase() {
    this.state.currentPhase = "presidentPolicy";
    this.drawPoliciesForPresident();
  }

  // Функция для взятия 3-х законов президентом
  drawPoliciesForPresident() {
    this.state.presidentPolicyHand.clear();
    // Если в колоде меньше 3-х карт, перемешиваем сброс обратно в колоду
    if (this.state.policyDeck.length < 3) {
      this.reshuffleDiscardPile();
    }

    // Президент берет 3 карты
    for (let i = 0; i < 3; i++) {
      if (this.state.policyDeck.length > 0) {
        this.state.presidentPolicyHand.push(this.state.policyDeck.shift());
      } else {
        console.warn("Policy deck is empty, cannot draw 3 policies.");
        break;
      }
    }

    const presidentClient = this.clients.find(c => c.sessionId === this.state.presidentId);
    if (presidentClient) {
      presidentClient.send("president-draw-policies", { policies: this.state.presidentPolicyHand.toArray() });
      console.log(`President ${this.state.players.get(this.state.presidentId)?.nickname} drew 3 policies.`);
    }
  }

  // Функция для перемешивания сброса обратно в колоду
  reshuffleDiscardPile() {
    console.log("Reshuffling discard pile into policy deck.");
    this.state.policyDeck.push(...this.state.discardPile.toArray());
    this.state.discardPile.clear();
    this.shuffleArray(this.state.policyDeck);
  }

  // Инициализация колоды законов
  initializePolicyDeck() {
    this.state.policyDeck.clear();
    this.state.discardPile.clear();

    // 6 либеральных законов
    for (let i = 0; i < 6; i++) {
      this.state.policyDeck.push("liberal");
    }

    // 11 фашистских законов
    for (let i = 0; i < 11; i++) {
      this.state.policyDeck.push("fascist");
    }

    this.shuffleArray(this.state.policyDeck);
  }

  // Вспомогательная функция для перемешивания массива
  shuffleArray(array: ArraySchema<string>) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Функция для проверки условий победы
  checkWinConditions(): boolean {
    // Проверка на убийство Гитлера (победа либералов)
    const hitlerPlayer = Array.from(this.state.players.values()).find(player => player.role === "hitler");
    if (hitlerPlayer && hitlerPlayer.isEliminated) {
      this.gameOver("liberal", "Liberals win! Hitler was assassinated!");
      return true;
    }

    // Проверка на немедленную победу фашистов (Гитлер-канцлер и 4-й фашистский закон)
    const chancellorPlayer = this.state.players.get(this.state.chancellorId);
    if (chancellorPlayer && chancellorPlayer.role === "hitler" && this.state.fascistPoliciesEnacted === 4) {
      this.gameOver("fascist", "Fascists win! Hitler as Chancellor enacted the 4th Fascist Policy!");
      return true;
    }

    if (this.state.liberalPoliciesEnacted >= 5) {
      this.gameOver("liberal", "Liberals win! 5 Liberal Policies enacted!");
      return true;
    } else if (this.state.fascistPoliciesEnacted >= 6) {
      this.gameOver("fascist", "Fascists win! 6 Fascist Policies enacted!");
      return true;
    } else {
      console.log("No win conditions met. Proceeding to next round.");
      return false;
    }
  }

  // Функция для начала фазы убийства
  startAssassinationPhase() {
    this.state.currentPhase = "assassination";
    console.log(`President ${this.state.players.get(this.state.presidentId)?.nickname} is selecting a player to assassinate.`);

    const presidentClient = this.clients.find(c => c.sessionId === this.state.presidentId);
    if (presidentClient) {
      const eligibleTargets = Array.from(this.state.players.entries())
        .filter(([sessionId, player]) => sessionId !== this.state.presidentId && !player.isEliminated)
        .map(([sessionId, player]) => ({ sessionId: sessionId, nickname: player.nickname }));
      presidentClient.send("start-assassination", { targets: eligibleTargets });
    }
  }

  // Функция для завершения игры
  gameOver(winner: "liberal" | "fascist", message?: string) {
    this.state.currentPhase = "gameOver";
    console.log(`Game Over! ${winner.toUpperCase()} wins! ${message || ''}`);
    this.broadcast("game-over", { winner: winner, message: message });
  }
}
