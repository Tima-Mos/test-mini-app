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

    players.forEach(([sessionId, player]: [string, any], index: number) => {
      const y = 150 + index * 50;

      // Фон для игрока
      const isCurrentPlayer = sessionId === this.room.sessionId;
      const isCreator = sessionId === this.room.state.creatorId;

      let bgColor = 0xE0E0E0;
      if (isCurrentPlayer) bgColor = 0xFFEB3B; // Желтый для текущего игрока
      if (isCreator) bgColor = 0xFFC107; // Золотой для создателя

      const playerBg = this.add.rectangle(400, y, 400, 40, bgColor);

      // Ник игрока
      let nameText = player.nickname;
      if (isCreator) nameText += " (Creator)";
      if (isCurrentPlayer) nameText += " (You)";

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