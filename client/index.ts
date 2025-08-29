import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import { getStateCallbacks } from "colyseus.js";

// Глобальные переменные для хранения ника и клиента
let playerNickname: string = "";
let gameClient: Client;

// Интерфейс для данных комнаты
interface RoomData {
  roomId: string;
  name: string;
  clients: number;
  maxClients: number;
  locked: boolean;
}

// Сцена для ввода ника
export class NicknameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NicknameScene' });
  }

  create() {
    // Инициализируем клиент
    gameClient = new Client("ws://localhost:2567");

    // Заголовок
    this.add.text(400, 200, 'Welcome to Multiplayer Game!', {
      fontSize: '28px',
      color: '#000000'
    }).setOrigin(0.5);

    this.add.text(400, 250, 'Please enter your nickname:', {
      fontSize: '18px',
      color: '#000000'
    }).setOrigin(0.5);

    // Запрашиваем ник у игрока
    const nickname = prompt('Enter your nickname:') || `Player_${Date.now()}`;
    playerNickname = nickname;

    // Переходим к выбору комнат
    this.scene.start('RoomSelectionScene');
  }
}

// Сцена меню выбора комнат
export class RoomSelectionScene extends Phaser.Scene {
  roomsContainer: Phaser.GameObjects.Container;
  selectedRoomId: string | null = null;

  constructor() {
    super({ key: 'RoomSelectionScene' });
  }

  create() {
    // Заголовок с ником
    this.add.text(400, 50, `Welcome, ${playerNickname}!`, {
      fontSize: '24px',
      color: '#000000'
    }).setOrigin(0.5);

    this.add.text(400, 80, 'Room Selection', {
      fontSize: '28px',
      color: '#000000'
    }).setOrigin(0.5);

    // Контейнер для списка комнат
    this.roomsContainer = this.add.container(0, 0);

    // Кнопка "Создать комнату"
    const createRoomButton = this.add.rectangle(200, 500, 150, 40, 0x4CAF50);
    createRoomButton.setInteractive();
    createRoomButton.on('pointerdown', () => this.createRoom());
    this.add.text(200, 500, 'Create Room', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Кнопка "Обновить список"
    const refreshButton = this.add.rectangle(400, 500, 150, 40, 0x2196F3);
    refreshButton.setInteractive();
    refreshButton.on('pointerdown', () => this.loadRooms());
    this.add.text(400, 500, 'Refresh', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Кнопка "Войти в комнату"
    const joinButton = this.add.rectangle(600, 500, 150, 40, 0xFF9800);
    joinButton.setInteractive();
    joinButton.on('pointerdown', () => this.joinSelectedRoom());
    this.add.text(600, 500, 'Join Room', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Загружаем список комнат
    this.loadRooms();
  }

  async loadRooms() {
    try {
      const response = await fetch('http://localhost:2567/api/rooms');
      const rooms: RoomData[] = await response.json();

      // Очищаем предыдущий список
      this.roomsContainer.removeAll(true);

      // Отображаем комнаты
      rooms.forEach((room, index) => {
        const y = 150 + index * 60;

        // Фон для комнаты
        const roomBg = this.add.rectangle(400, y, 500, 50, 0xE0E0E0);
        roomBg.setInteractive();
        roomBg.on('pointerdown', () => {
          this.selectedRoomId = room.roomId;
          // Подсвечиваем выбранную комнату
          this.roomsContainer.each((child: any) => {
            if (child.fillColor !== undefined) {
              child.setFillStyle(child === roomBg ? 0xFFEB3B : 0xE0E0E0);
            }
          });
        });

        // Информация о комнате
        const roomText = this.add.text(200, y, `${room.name} (${room.clients}/${room.maxClients})`, {
          fontSize: '18px',
          color: '#000000'
        }).setOrigin(0, 0.5);

        const roomIdText = this.add.text(600, y, `ID: ${room.roomId.substring(0, 8)}...`, {
          fontSize: '14px',
          color: '#666666'
        }).setOrigin(1, 0.5);

        this.roomsContainer.add([roomBg, roomText, roomIdText]);
      });

    } catch (error) {
      console.error('Failed to load rooms:', error);
      this.add.text(400, 200, 'Failed to load rooms', {
        fontSize: '18px',
        color: '#ff0000'
      }).setOrigin(0.5);
    }
  }

  async createRoom() {
    const roomName = prompt('Enter room name:') || `${playerNickname}'s Room`;

    try {
      const response = await fetch('http://localhost:2567/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roomName,
          nickname: playerNickname
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('Room created:', result);
        // Сразу переходим в созданную комнату как создатель
        this.scene.start('LobbyScene', {
          roomId: result.roomId,
          sessionId: result.sessionId,
          isCreator: true
        });
      } else {
        alert('Failed to create room: ' + result.error);
      }

    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room');
    }
  }

  async joinSelectedRoom() {
    if (!this.selectedRoomId) {
      alert('Please select a room first');
      return;
    }

    try {
      // Присоединяемся к выбранной комнате
      const room = await gameClient.joinById(this.selectedRoomId, { nickname: playerNickname });

      // Переходим к сцене лобби
      this.scene.start('LobbyScene', {
        roomId: this.selectedRoomId,
        room: room,
        isCreator: false
      });
    } catch (error) {
      console.error('Failed to join room:', error);
      alert('Failed to join room: ' + error.message);
    }
  }
}

// Сцена лобби
export class LobbyScene extends Phaser.Scene {
  room: Room;
  roomId: string;
  isCreator: boolean = false;
  playersContainer: Phaser.GameObjects.Container;
  readyButton: Phaser.GameObjects.Rectangle;
  startButton: Phaser.GameObjects.Rectangle;
  readyButtonText: Phaser.GameObjects.Text;
  isReady: boolean = false;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: any) {
    this.roomId = data.roomId;
    this.isCreator = data.isCreator;

    // Если у нас уже есть подключение к комнате (от создания)
    if (data.room) {
      this.room = data.room;
    }
  }

  async create() {
    // Если комната не была передана, подключаемся используя sessionId из создания
    if (!this.room) {
      try {
        // Для всех случаев используем обычное подключение по ID комнаты
        this.room = await gameClient.joinById(this.roomId, { nickname: playerNickname });
      } catch (error) {
        console.error('Failed to connect to room:', error);
        alert('Failed to connect to room');
        this.scene.start('RoomSelectionScene');
        return;
      }
    }

    this.setupUI();
    this.setupRoomEvents();
  }

  setupUI() {
    // Заголовок
    this.add.text(400, 50, 'Game Lobby', {
      fontSize: '32px',
      color: '#000000'
    }).setOrigin(0.5);

    this.add.text(400, 90, `Room: ${this.roomId.substring(0, 8)}...`, {
      fontSize: '18px',
      color: '#666666'
    }).setOrigin(0.5);

    // Контейнер для списка игроков
    this.playersContainer = this.add.container(0, 0);

    // Кнопка готовности
    this.readyButton = this.add.rectangle(300, 450, 120, 40, 0x2196F3);
    this.readyButton.setInteractive();
    this.readyButton.on('pointerdown', () => this.toggleReady());

    this.readyButtonText = this.add.text(300, 450, 'Ready', {
      fontSize: '16px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Кнопка начала игры (только для создателя)
    if (this.isCreator) {
      this.startButton = this.add.rectangle(500, 450, 120, 40, 0x4CAF50);
      this.startButton.setInteractive();
      this.startButton.on('pointerdown', () => this.startGame());
      this.startButton.setAlpha(0.5); // Изначально неактивна

      this.add.text(500, 450, 'Start Game', {
        fontSize: '16px',
        color: '#ffffff'
      }).setOrigin(0.5);
    }

    // Кнопка "Назад"
    const backButton = this.add.rectangle(100, 550, 120, 40, 0xF44336);
    backButton.setInteractive();
    backButton.on('pointerdown', () => {
      if (this.room) {
        this.room.leave();
      }
      this.scene.start('RoomSelectionScene');
    });
    this.add.text(100, 550, 'Back to Menu', {
      fontSize: '14px',
      color: '#ffffff'
    }).setOrigin(0.5);
  }

  setupRoomEvents() {
    const $ = getStateCallbacks(this.room);

    // Слушаем добавление игроков
    $(this.room.state).players.onAdd((player, sessionId) => {
      console.log(`Player ${player.nickname} joined!`);
      this.updatePlayersList();

      // Listen for changes to the player's ready status
      $(player).listen("ready", (value, previousValue) => {
        console.log(`Player ${player.nickname} ready status changed to ${value}`);
        this.updatePlayersList();
      });
    });

    // Слушаем удаление игроков
    $(this.room.state).players.onRemove((player, sessionId) => {
      console.log(`Player ${player.nickname} left!`);
      this.updatePlayersList();
    });

    // Слушаем изменения игроков
    // Removed: $(this.room.state).players.onChange((player, sessionId) => {
    //   this.updatePlayersList();
    // });

    // Слушаем сообщения от сервера
    this.room.onMessage("room-joined", (data) => {
      this.isCreator = data.isCreator;
      if (this.isCreator && this.startButton) {
        this.startButton.setVisible(true);
      }
    });

    this.room.onMessage("you-are-creator", () => {
      this.isCreator = true;
      if (this.startButton) {
        this.startButton.setVisible(true);
      }
    });

    this.room.onMessage("all-players-ready", () => {
      if (this.isCreator && this.startButton) {
        this.startButton.setAlpha(1); // Активируем кнопку старта
      }
    });

    this.room.onMessage("game-started", () => {
      // Переходим к игровой сцене
      this.scene.start('GameScene', {
        room: this.room,
        roomId: this.roomId
      });
    });

    // Обновляем список при первой загрузке
    this.updatePlayersList();
  }

  updatePlayersList() {
    // Очищаем предыдущий список
    this.playersContainer.removeAll(true);

    const players = Array.from((this.room.state.players as Map<string, any>).entries());

    players.forEach(([sessionId, player]: [string, { nickname: string, ready: boolean, isEliminated: boolean }], index: number) => {
      const y = 150 + index * 50;

      // Фон для игрока
      const isCurrentPlayer = sessionId === this.room.sessionId;
      const isCreator = sessionId === this.room.state.creatorId;
      let bgColor = 0xE0E0E0;
      if (isCurrentPlayer) bgColor = 0xFFEB3B; // Желтый для текущего игрока
      if (isCreator) bgColor = 0xFFC107; // Золотой для создателя
      if (player.isEliminated) bgColor = 0x808080; // Серый для выбывших игроков

      const playerBg = this.add.rectangle(400, y, 400, 40, bgColor);

      // Ник игрока
      let nameText = player.nickname;
      if (isCreator) nameText += " (Creator)";
      if (isCurrentPlayer) nameText += " (You)";
      if (player.isEliminated) nameText += " (ELIMINATED)";

      const playerName = this.add.text(250, y, nameText, {
        fontSize: '16px',
        color: '#000000'
      }).setOrigin(0, 0.5);

      // Статус готовности
      const readyText = this.add.text(550, y, player.ready ? 'READY' : 'NOT READY', {
        fontSize: '14px',
        color: player.ready ? '#4CAF50' : '#F44336'
      }).setOrigin(0, 0.5);

      this.playersContainer.add([playerBg, playerName, readyText]);
    });
  }

  toggleReady() {
    this.room.send("toggle-ready");
    // Removed: Client-side UI update for ready button, now relying on server state
    // this.isReady = !this.isReady;
    // this.readyButtonText.setText(this.isReady ? 'Not Ready' : 'Ready');
    // this.readyButton.setFillStyle(this.isReady ? 0xF44336 : 0x2196F3);
  }

  startGame() {
    if (this.isCreator) {
      this.room.send("start-game");
    }
  }
}

// Игровая сцена (упрощенная версия для демонстрации)
export class GameScene extends Phaser.Scene {
  room: Room;
  roomId: string;
  liberalPolicyCards: Phaser.GameObjects.Rectangle[] = [];
  fascistPolicyCards: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: any) {
    this.room = data.room;
    this.roomId = data.roomId;
  }

  preload() {
    // No preload content needed for this scene anymore
  }

  create() {
    // Re-add your-role message listener here
    this.room.onMessage("your-role", (message) => {
      this.displayRoleCard(message.role);
    });

    // Add new unified president-info message listener here
    this.room.onMessage("president-info", (message) => {
      this.displayPresidentInfoCard(message.presidentId, message.presidentNickname);
    });

    // Add new select-chancellor message listener here
    this.room.onMessage("select-chancellor", (message) => {
      this.displayChancellorSelection(message.players);
    });

    // Add new chancellor-info message listener here
    this.room.onMessage("chancellor-info", (message) => {
      this.displayChancellorInfoCard(message.chancellorId, message.chancellorNickname);
    });

    // Add new president-candidate-info message listener here
    this.room.onMessage("president-candidate-info", (message) => {
      // Можно просто игнорировать это сообщение на клиенте, так как `start-vote` содержит ту же информацию.
      console.log(`President candidate is: ${message.presidentCandidateNickname}`);
    });

    // Add new start-vote message listener here
    this.room.onMessage("start-vote", (message) => {
      this.displayVotingUI(message.presidentCandidateId, message.presidentCandidateNickname, message.chancellorCandidateId, message.chancellorCandidateNickname);
    });

    // Add new voting-results message listener here
    this.room.onMessage("voting-results", (message) => {
      this.displayVotingResults(message.votePassed, message.message);
    });

    // Add new policy phase message listeners here
    this.room.onMessage("president-draw-policies", (message) => {
      this.displayPresidentPolicySelection(message.policies);
    });

    this.room.onMessage("chancellor-select-policy", (message) => {
      this.displayChancellorPolicySelection(message.policies);
    });

    this.room.onMessage("policy-played", (message) => {
      this.updatePolicyBoards(message.policyType, message.liberalPolicies, message.fascistPolicies);
    });

    // Add new game-over message listener here
    this.room.onMessage("game-over", (message) => {
      this.displayGameOver(message.winner, message.message);
    });

    // Add new assassination message listeners
    this.room.onMessage("start-assassination", (message) => {
      this.displayAssassinationSelection(message.targets);
    });

    this.room.onMessage("player-eliminated", (message) => {
      this.displayPlayerEliminated(message.eliminatedPlayerId, message.message);
    });

    // Кнопка "Назад к лобби"
    const backButton = this.add.rectangle(70, 30, 120, 40, 0xF44336);
    backButton.setInteractive();
    backButton.on('pointerdown', () => {
      // Возвращаемся к лобби
      this.scene.start('LobbyScene', {
        room: this.room,
        roomId: this.roomId,
        isCreator: false
      });
    });
    this.add.text(70, 30, 'Back to Lobby', {
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);

    // All game-related (airplane) code removed
  }

  displayRoleCard(role: string) {
    const roleCard = this.add.rectangle(400, 300, 500, 200, 0x000000, 0.7);
    roleCard.setScrollFactor(0); // Фиксируем на экране
    roleCard.setDepth(1000); // Поверх всего остального

    const roleText = this.add.text(400, 300, `Your role: ${role.toUpperCase()}`,
      { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    roleText.setScrollFactor(0);
    roleText.setDepth(1001);

    this.time.delayedCall(5000, () => {
      roleCard.destroy();
      roleText.destroy();
    }, [], this);
  }

  // New unified function for displaying president info
  displayPresidentInfoCard(presidentId: string, presidentNickname: string) {
    const isCurrentPlayerPresident = presidentId === this.room.sessionId;
    const cardColor = isCurrentPlayerPresident ? 0x0000FF : 0x008000; // Blue for president, green for others
    const messageText = isCurrentPlayerPresident ? 'YOU ARE PRESIDENT!' : `${presidentNickname.toUpperCase()} IS PRESIDENT!`;

    const presidentCard = this.add.rectangle(400, 300, 500, 200, cardColor, 0.7);
    presidentCard.setScrollFactor(0);
    presidentCard.setDepth(1000);

    const presidentText = this.add.text(400, 300, messageText,
      { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    presidentText.setScrollFactor(0);
    presidentText.setDepth(1001);

    this.time.delayedCall(5000, () => {
      presidentCard.destroy();
      presidentText.destroy();
    }, [], this);
  }

  // New function for displaying chancellor selection to the president
  displayChancellorSelection(players: { sessionId: string; nickname: string }[]) {
    const selectionContainer = this.add.container(0, 0);
    selectionContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    selectionContainer.add(background);

    const title = this.add.text(400, 150, 'SELECT CHANCELLOR', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    selectionContainer.add(title);

    players.forEach((player, index) => {
      const y = 220 + index * 60;

      const playerCard = this.add.rectangle(400, y, 400, 50, 0x2196F3, 0.9);
      playerCard.setInteractive();
      playerCard.on('pointerdown', () => {
        this.room.send("chancellor-selected", { chancellorId: player.sessionId });
        selectionContainer.destroy(true);
      });
      selectionContainer.add(playerCard);

      const playerText = this.add.text(400, y, player.nickname, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      selectionContainer.add(playerText);
    });
  }

  // New function for displaying chancellor info to all players
  displayChancellorInfoCard(chancellorId: string, chancellorNickname: string) {
    const isCurrentPlayerChancellor = chancellorId === this.room.sessionId;
    const cardColor = isCurrentPlayerChancellor ? 0x00FF00 : 0x008000; // Green for chancellor, darker green for others
    const messageText = isCurrentPlayerChancellor ? 'YOU ARE CHANCELLOR!' : `${chancellorNickname.toUpperCase()} IS CHANCELLOR!`;

    const chancellorCard = this.add.rectangle(400, 300, 500, 200, cardColor, 0.7);
    chancellorCard.setScrollFactor(0);
    chancellorCard.setDepth(1000);

    const chancellorText = this.add.text(400, 300, messageText,
      { fontSize: '48px', color: '#ffffff' }).setOrigin(0.5);
    chancellorText.setScrollFactor(0);
    chancellorText.setDepth(1001);

    this.time.delayedCall(5000, () => {
      chancellorCard.destroy();
      chancellorText.destroy();
    }, [], this);
  }

  // New function to display voting UI
  displayVotingUI(presidentId: string, presidentNickname: string, chancellorId: string, chancellorNickname: string) {
    const votingContainer = this.add.container(0, 0);
    votingContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    votingContainer.add(background);

    const title = this.add.text(400, 100, 'VOTE FOR GOVERNMENT', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    votingContainer.add(title);

    // President Card
    const presidentCardBg = this.add.rectangle(250, 220, 250, 100, 0x0000FF, 0.9);
    votingContainer.add(presidentCardBg);
    const presidentCardText = this.add.text(250, 220, `President:\n${presidentNickname}`, { fontSize: '20px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    votingContainer.add(presidentCardText);

    // Chancellor Card
    const chancellorCardBg = this.add.rectangle(550, 220, 250, 100, 0x00FF00, 0.9);
    votingContainer.add(chancellorCardBg);
    const chancellorCardText = this.add.text(550, 220, `Chancellor:\n${chancellorNickname}`, { fontSize: '20px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    votingContainer.add(chancellorCardText);

    // Vote "For" button
    const voteForButton = this.add.rectangle(300, 400, 150, 50, 0x4CAF50);
    voteForButton.setInteractive();
    voteForButton.on('pointerdown', () => {
      this.room.send("cast-vote", { vote: "for" });
      votingContainer.destroy(true);
    });
    votingContainer.add(voteForButton);
    const voteForText = this.add.text(300, 400, 'FOR', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    votingContainer.add(voteForText);

    // Vote "Against" button
    const voteAgainstButton = this.add.rectangle(500, 400, 150, 50, 0xF44336);
    voteAgainstButton.setInteractive();
    voteAgainstButton.on('pointerdown', () => {
      this.room.send("cast-vote", { vote: "against" });
      votingContainer.destroy(true);
    });
    votingContainer.add(voteAgainstButton);
    const voteAgainstText = this.add.text(500, 400, 'AGAINST', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    votingContainer.add(voteAgainstText);

    // Disable voting buttons if the player has already voted (based on state, if implemented)
    // For now, destroy the container after voting.
  }

  // New function to display voting results
  displayVotingResults(votePassed: boolean, message: string) {
    const resultsContainer = this.add.container(0, 0);
    resultsContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    resultsContainer.add(background);

    const resultText = this.add.text(400, 300, message, { fontSize: '32px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    resultsContainer.add(resultText);

    this.time.delayedCall(5000, () => {
      resultsContainer.destroy(true);
      // Здесь можно добавить логику для перехода к следующей фазе игры
    }, [], this);
  }

  // New function to display president's policy selection UI
  displayPresidentPolicySelection(policies: string[]) {
    const presidentPolicyContainer = this.add.container(0, 0);
    presidentPolicyContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    presidentPolicyContainer.add(background);

    const title = this.add.text(400, 100, 'PRESIDENT: DISCARD ONE POLICY', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    presidentPolicyContainer.add(title);

    policies.forEach((policy, index) => {
      const x = 200 + index * 200;
      const policyCard = this.add.rectangle(x, 300, 150, 200, policy === "liberal" ? 0x0000FF : 0xFF0000, 0.9); // Blue for liberal, Red for fascist
      policyCard.setInteractive();
      policyCard.on('pointerdown', () => {
        this.room.send("president-discard-policy", { policy: policy });
        presidentPolicyContainer.destroy(true);
      });
      presidentPolicyContainer.add(policyCard);

      const policyText = this.add.text(x, 300, policy.toUpperCase(), { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      presidentPolicyContainer.add(policyText);
    });
  }

  // New function to display chancellor's policy selection UI
  displayChancellorPolicySelection(policies: string[]) {
    const chancellorPolicyContainer = this.add.container(0, 0);
    chancellorPolicyContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    chancellorPolicyContainer.add(background);

    const title = this.add.text(400, 100, 'CHANCELLOR: PLAY ONE POLICY', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    chancellorPolicyContainer.add(title);

    policies.forEach((policy, index) => {
      const x = 300 + index * 200;
      const policyCard = this.add.rectangle(x, 300, 150, 200, policy === "liberal" ? 0x0000FF : 0xFF0000, 0.9);
      policyCard.setInteractive();
      policyCard.on('pointerdown', () => {
        this.room.send("chancellor-play-policy", { policy: policy });
        chancellorPolicyContainer.destroy(true);
      });
      chancellorPolicyContainer.add(policyCard);

      const policyText = this.add.text(x, 300, policy.toUpperCase(), { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      chancellorPolicyContainer.add(policyText);
    });
  }

  // Function to update policy boards (liberal and fascist)
  updatePolicyBoards(policyType: string, liberalPolicies: number, fascistPolicies: number) {
    console.log(`Policy played: ${policyType}. Liberal: ${liberalPolicies}, Fascist: ${fascistPolicies}`);

    // Очищаем текущие доски (можно сделать это более умно, чтобы не удалять каждый раз все)
    this.liberalPolicyCards.forEach(card => card.destroy());
    this.fascistPolicyCards.forEach(card => card.destroy());
    this.liberalPolicyCards = [];
    this.fascistPolicyCards = [];

    const liberalBoardX = 200;
    const fascistBoardX = 600;
    const startY = 200;
    const policyHeight = 50;
    const policySpacing = 10;

    // Добавляем либеральные законы
    for (let i = 0; i < liberalPolicies; i++) {
      const y = startY + i * (policyHeight + policySpacing);
      const card = this.add.rectangle(liberalBoardX, y, 100, policyHeight, 0x0000FF, 0.9);
      this.liberalPolicyCards.push(card);
      this.add.text(liberalBoardX, y, 'LIBERAL', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    }

    // Добавляем фашистские законы
    for (let i = 0; i < fascistPolicies; i++) {
      const y = startY + i * (policyHeight + policySpacing);
      const card = this.add.rectangle(fascistBoardX, y, 100, policyHeight, 0xFF0000, 0.9);
      this.fascistPolicyCards.push(card);
      this.add.text(fascistBoardX, y, 'FASCIST', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    }

    // Обновляем счетчики законов
    // Можно добавить текстовые объекты для отображения количества законов
    const liberalCountText = this.add.text(liberalBoardX, startY - 50, `Liberal: ${liberalPolicies}/5`, { fontSize: '18px', color: '#0000FF' }).setOrigin(0.5);
    const fascistCountText = this.add.text(fascistBoardX, startY - 50, `Fascist: ${fascistPolicies}/6`, { fontSize: '18px', color: '#FF0000' }).setOrigin(0.5);

    // Удаляем их после небольшой задержки или храним ссылки и обновляем
    this.time.delayedCall(5000, () => {
      liberalCountText.destroy();
      fascistCountText.destroy();
    }, [], this);
  }

  // New function to display game over screen
  displayGameOver(winner: string, message: string) {
    const gameOverContainer = this.add.container(0, 0);
    gameOverContainer.setDepth(1003); // Выше всех остальных UI

    const background = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.9);
    gameOverContainer.add(background);

    const winnerText = this.add.text(400, 250, `GAME OVER!\n${winner.toUpperCase()} TEAM WINS!\n${message}`, { fontSize: '48px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    gameOverContainer.add(winnerText);

    const restartButton = this.add.rectangle(400, 400, 200, 50, 0x2196F3);
    restartButton.setInteractive();
    restartButton.on('pointerdown', () => {
      // Перезагрузка страницы или возврат в главное меню
      window.location.reload();
    });
    gameOverContainer.add(restartButton);

    const restartText = this.add.text(400, 400, 'RESTART', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    gameOverContainer.add(restartText);
  }

  // New function to display assassination target selection to the president
  displayAssassinationSelection(targets: { sessionId: string; nickname: string }[]) {
    const selectionContainer = this.add.container(0, 0);
    selectionContainer.setDepth(1002);

    const background = this.add.rectangle(400, 300, 700, 400, 0x000000, 0.8);
    selectionContainer.add(background);

    const title = this.add.text(400, 100, 'PRESIDENT: SELECT PLAYER TO ASSASSINATE', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    selectionContainer.add(title);

    targets.forEach((player, index) => {
      const y = 180 + index * 60;

      const playerCard = this.add.rectangle(400, y, 400, 50, 0xF44336, 0.9); // Red for assassination target
      playerCard.setInteractive();
      playerCard.on('pointerdown', () => {
        this.room.send("president-assassinate-player", { targetId: player.sessionId });
        selectionContainer.destroy(true);
      });
      selectionContainer.add(playerCard);

      const playerText = this.add.text(400, y, player.nickname, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
      selectionContainer.add(playerText);
    });
  }

  // New function to display player eliminated message
  displayPlayerEliminated(eliminatedPlayerId: string, message: string) {
    const eliminatedContainer = this.add.container(0, 0);
    eliminatedContainer.setDepth(1003);

    const background = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.9);
    eliminatedContainer.add(background);

    const eliminatedText = this.add.text(400, 300, message, { fontSize: '48px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    eliminatedContainer.add(eliminatedText);

    this.time.delayedCall(5000, () => {
      eliminatedContainer.destroy(true);
    }, [], this);
  }
}

// Конфигурация игры
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#b6d53c',
  parent: 'phaser-example',
  pixelArt: true,
  scene: [NicknameScene, RoomSelectionScene, LobbyScene, GameScene],
};

// Запуск игры
const game = new Phaser.Game(config);