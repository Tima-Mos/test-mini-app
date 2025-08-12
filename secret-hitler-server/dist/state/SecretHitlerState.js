"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretHitlerState = exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.name = '';
        this.connected = true;
        this.role = '';
        this.alive = true;
        this.ready = false;
    }
}
exports.Player = Player;
__decorate([
    (0, schema_1.type)('string')
], Player.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)('boolean')
], Player.prototype, "connected", void 0);
__decorate([
    (0, schema_1.type)('string')
], Player.prototype, "role", void 0);
__decorate([
    (0, schema_1.type)('boolean')
], Player.prototype, "alive", void 0);
__decorate([
    (0, schema_1.type)('boolean')
], Player.prototype, "ready", void 0);
class SecretHitlerState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.phase = 'lobby';
        this.electionTracker = 0;
        this.enactedFascist = 0;
        this.enactedLiberal = 0;
        this.presidentId = '';
        this.chancellorId = '';
    }
}
exports.SecretHitlerState = SecretHitlerState;
__decorate([
    (0, schema_1.type)({ map: Player })
], SecretHitlerState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)('string')
], SecretHitlerState.prototype, "phase", void 0);
__decorate([
    (0, schema_1.type)('number')
], SecretHitlerState.prototype, "electionTracker", void 0);
__decorate([
    (0, schema_1.type)('number')
], SecretHitlerState.prototype, "enactedFascist", void 0);
__decorate([
    (0, schema_1.type)('number')
], SecretHitlerState.prototype, "enactedLiberal", void 0);
__decorate([
    (0, schema_1.type)('string')
], SecretHitlerState.prototype, "presidentId", void 0);
__decorate([
    (0, schema_1.type)('string')
], SecretHitlerState.prototype, "chancellorId", void 0);
//# sourceMappingURL=SecretHitlerState.js.map