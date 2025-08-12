"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const core_1 = require("@colyseus/core");
const SecretHitlerRoom_1 = require("./rooms/SecretHitlerRoom");
const PORT = process.env.PORT ? Number(process.env.PORT) : 2567;
async function main() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.get('/', (_req, res) => res.send('Secret Hitler Server is running'));
    const server = http_1.default.createServer(app);
    const gameServer = new core_1.Server({ server });
    gameServer.define('secret_hitler', SecretHitlerRoom_1.SecretHitlerRoom).enableRealtimeListing();
    await gameServer.listen(PORT);
    console.log(`Colyseus listening on ws://localhost:${PORT}`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map