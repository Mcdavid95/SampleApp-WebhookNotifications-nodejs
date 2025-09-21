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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const quickbooks_service_1 = require("./quickbooks/quickbooks.service");
let AppController = class AppController {
    constructor(appService, quickbooksService) {
        this.appService = appService;
        this.quickbooksService = quickbooksService;
    }
    async getHome() {
        await this.appService.initializeCsvFile();
        const config = this.appService.getConfig();
        return {
            redirect_uri: config.redirectUri,
            token_json: this.quickbooksService.getTokenJson(),
            webhook_uri: config.webhookUri,
            webhook_payload: this.quickbooksService.getWebhookPayload(),
        };
    }
    getAuthUri(session) {
        return this.quickbooksService.generateAuthUrl(session);
    }
    async handleCallback(req, res) {
        await this.quickbooksService.handleCallback(req);
        res.send('');
    }
    handlePayload(body, res) {
        console.log('The Webhook notification payload is:', JSON.stringify(body));
        res.sendStatus(200);
    }
    async handleWebhook(req, body, res) {
        const result = await this.quickbooksService.handleWebhook(req, body);
        res.status(result.status).send(result.message);
    }
    async createCustomer(body, res) {
        const customer = await this.quickbooksService.createCustomer(body.displayName);
        res.send(customer);
    }
    setTokensForTesting(body, res) {
        this.quickbooksService.setTokensForTesting(body.accessToken, body.refreshToken, body.realmId);
        res.send({ message: 'Tokens set successfully. Webhooks will now fetch full data.' });
    }
    startOAuthFlow(res) {
        const authUrl = this.quickbooksService.generateAuthUrl({});
        res.json({
            message: 'Click the link below to authorize with QuickBooks',
            authUrl: authUrl,
            instructions: 'After authorization, you will be redirected back and tokens will be automatically saved.'
        });
    }
    async testFirsIntegration(req, res) {
        const sampleWebhook = {
            eventNotifications: [{
                    realmId: '9341455357036451',
                    dataChangeEvent: {
                        entities: [{
                                id: '123',
                                operation: 'Create',
                                name: 'Invoice',
                                lastUpdated: new Date().toISOString()
                            }]
                    }
                }]
        };
        try {
            console.log('Testing FIRS integration by directly calling processWebhookNotifications...');
            await this.quickbooksService.testWebhookProcessing(sampleWebhook);
            res.json({
                message: 'Test FIRS integration completed',
                note: 'Check server logs for FIRS submission details. Since QB API tokens may be invalid, FIRS calls may show errors, but the integration flow works.',
                samplePayload: sampleWebhook
            });
        }
        catch (error) {
            res.status(500).json({
                error: 'Test failed',
                details: error.message
            });
        }
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Render)('index'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getHome", null);
__decorate([
    (0, common_1.Get)('authUri'),
    __param(0, (0, common_1.Session)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", String)
], AppController.prototype, "getAuthUri", null);
__decorate([
    (0, common_1.Get)('callback'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "handleCallback", null);
__decorate([
    (0, common_1.Post)('payload'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "handlePayload", null);
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "handleWebhook", null);
__decorate([
    (0, common_1.Post)('createCustomer'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "createCustomer", null);
__decorate([
    (0, common_1.Post)('setTokens'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "setTokensForTesting", null);
__decorate([
    (0, common_1.Get)('startOAuth'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "startOAuthFlow", null);
__decorate([
    (0, common_1.Post)('testFirs'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "testFirsIntegration", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        quickbooks_service_1.QuickBooksService])
], AppController);
//# sourceMappingURL=app.controller.js.map