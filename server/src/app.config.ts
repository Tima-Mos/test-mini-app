import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import { Request, Response } from "express";
import { matchMaker } from "colyseus";

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom";

let gameServerInstance: any = null;

export default config({

    initializeGameServer: (gameServer: any) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('my_room', MyRoom);
        // gameServer.simulateLatency(200);

        // Сохраняем ссылку на gameServer
        gameServerInstance = gameServer;

    },

    initializeExpress: (app: any) => {
        // Добавляем поддержку JSON и CORS
        app.use((req: Request, res: Response, next: any) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        app.use(require('express').json());

        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/hello_world", (req: Request, res: Response) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        // API для получения списка всех комнат
        app.get("/api/rooms", async (req: Request, res: Response) => {
            try {
                // Используем query для получения всех комнат типа my_room
                const rooms = await matchMaker.query({ name: 'my_room' });

                const formattedRooms = rooms.map((room: any) => ({
                    roomId: room.roomId,
                    name: room.metadata?.name || `Room ${room.roomId.substring(0, 8)}`,
                    clients: room.clients || 0,
                    maxClients: room.maxClients || 4,
                    locked: room.locked || false
                }));

                res.json(formattedRooms);
            } catch (error: any) {
                console.error('Error fetching rooms:', error);
                res.json([]); // Возвращаем пустой массив если комнат нет
            }
        });

        // API для создания новой комнаты (с автоматическим присоединением создателя)
        app.post("/api/rooms", async (req: Request, res: Response) => {
            const { name, nickname } = req.body;

            try {
                // Используем create для создания комнаты с резервацией места для создателя
                const reservation = await matchMaker.create('my_room', {
                    name: name || `Room ${Date.now()}`,
                    nickname: nickname || 'Anonymous'
                });

                res.json({
                    roomId: reservation.room.roomId,
                    sessionId: reservation.sessionId,
                    name: name || `Room ${Date.now()}`,
                    success: true
                });
            } catch (error: any) {
                console.error('Error creating room:', error);
                res.status(500).json({
                    error: error.message || 'Failed to create room',
                    success: false
                });
            }
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/monitor", monitor());
    },


    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
