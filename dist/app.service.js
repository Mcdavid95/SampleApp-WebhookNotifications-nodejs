"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let AppService = class AppService {
    constructor() {
        this.loadConfig();
    }
    loadConfig() {
        const configPath = path.join(process.cwd(), 'config.json');
        const configFile = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(configFile);
    }
    getConfig() {
        return this.config;
    }
    async initializeCsvFile() {
        const fields = [
            'realmId', 'entityType', 'id', 'operation', 'lastUpdated',
            'fetchStatus', 'errorMessage', 'fullDataJSON'
        ];
        const newLine = '\r\n';
        const headerLine = fields.join(',') + newLine;
        try {
            await fs.promises.writeFile('file.csv', headerLine);
            console.log('CSV file initialized with enhanced headers');
        }
        catch (error) {
            throw error;
        }
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AppService);
//# sourceMappingURL=app.service.js.map