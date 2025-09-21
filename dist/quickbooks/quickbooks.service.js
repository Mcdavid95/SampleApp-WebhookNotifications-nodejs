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
exports.QuickBooksService = void 0;
const common_1 = require("@nestjs/common");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const queryString = require("query-string");
const request = require("request");
const QuickBooks = require('node-quickbooks');
const json2csv = require("json2csv");
const Tokens = require("csrf");
const firs_service_1 = require("../firs/firs.service");
let QuickBooksService = class QuickBooksService {
    constructor(firsService) {
        this.firsService = firsService;
        this.csrf = new Tokens();
        this.loadConfig();
        this.loadTokensFromFile();
    }
    setTokensForTesting(accessToken, refreshToken, realmId) {
        const tokenData = {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: 3600,
            x_refresh_token_expires_in: 8726400,
            created_at: Date.now()
        };
        this.tokenJson = JSON.stringify(tokenData, null, 2);
        this.realmId = realmId;
        this.saveTokensToFile(tokenData, realmId);
        console.log('Tokens set for testing - webhook will now fetch full data');
    }
    loadTokensFromFile() {
        try {
            const tokenPath = path.join(process.cwd(), 'tokens.json');
            if (fs.existsSync(tokenPath)) {
                const tokenFile = fs.readFileSync(tokenPath, 'utf8');
                const tokenData = JSON.parse(tokenFile);
                if (this.areTokensValid(tokenData.tokens)) {
                    this.tokenJson = JSON.stringify(tokenData.tokens, null, 2);
                    this.realmId = tokenData.realmId;
                    console.log('Loaded valid tokens from file');
                }
                else {
                    console.log('Stored tokens are expired, will need to refresh');
                    this.refreshStoredTokens(tokenData);
                }
            }
            else {
                console.log('No stored tokens found');
            }
        }
        catch (error) {
            console.error('Error loading tokens from file:', error.message);
        }
    }
    saveTokensToFile(tokens, realmId) {
        try {
            const tokenPath = path.join(process.cwd(), 'tokens.json');
            const tokenData = {
                tokens: tokens,
                realmId: realmId,
                saved_at: new Date().toISOString()
            };
            fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
            console.log('Tokens saved to file');
        }
        catch (error) {
            console.error('Error saving tokens to file:', error.message);
        }
    }
    areTokensValid(tokens) {
        if (!tokens || !tokens.created_at || !tokens.expires_in) {
            return false;
        }
        const expiryTime = tokens.created_at + (tokens.expires_in * 1000);
        const currentTime = Date.now();
        const bufferTime = 5 * 60 * 1000;
        return currentTime < (expiryTime - bufferTime);
    }
    async refreshStoredTokens(tokenData) {
        if (!tokenData.tokens.refresh_token) {
            console.log('No refresh token available, need new OAuth flow');
            return;
        }
        try {
            console.log('Attempting to refresh expired tokens...');
            const refreshedTokens = await this.refreshAccessToken(tokenData.tokens.refresh_token);
            if (refreshedTokens) {
                this.tokenJson = JSON.stringify(refreshedTokens, null, 2);
                this.realmId = tokenData.realmId;
                this.saveTokensToFile(refreshedTokens, tokenData.realmId);
                console.log('Successfully refreshed tokens');
            }
        }
        catch (error) {
            console.error('Failed to refresh tokens:', error.message);
            console.log('Will need new OAuth flow');
        }
    }
    async refreshAccessToken(refreshToken) {
        const auth = Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64');
        const postBody = {
            url: this.config.token_endpoint,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + auth,
            },
            form: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }
        };
        return new Promise((resolve, reject) => {
            request.post(postBody, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Token refresh failed with status ${res.statusCode}: ${res.body}`));
                    return;
                }
                const accessToken = JSON.parse(res.body);
                accessToken.created_at = Date.now();
                resolve(accessToken);
            });
        });
    }
    loadConfig() {
        const configPath = path.join(process.cwd(), 'config.json');
        const configFile = fs.readFileSync(configPath, 'utf8');
        this.config = JSON.parse(configFile);
    }
    getTokenJson() {
        return this.tokenJson;
    }
    getWebhookPayload() {
        return this.webhookPayload;
    }
    generateAuthUrl(session) {
        session.secret = this.csrf.secretSync();
        const state = this.csrf.create(session.secret);
        const redirecturl = this.config.authorization_endpoint +
            '?client_id=' + this.config.clientId +
            '&redirect_uri=' + encodeURIComponent(this.config.redirectUri) +
            '&scope=' + this.config.scopes.connect_to_quickbooks[0] +
            '&response_type=code' +
            '&state=' + state;
        return redirecturl;
    }
    async handleCallback(req) {
        const parsedUri = queryString.parse(req.originalUrl);
        this.realmId = parsedUri.realmId;
        const auth = Buffer.from(this.config.clientId + ':' + this.config.clientSecret).toString('base64');
        const postBody = {
            url: this.config.token_endpoint,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: 'Basic ' + auth,
            },
            form: {
                grant_type: 'authorization_code',
                code: req.query.code,
                redirect_uri: this.config.redirectUri
            }
        };
        return new Promise((resolve, reject) => {
            request.post(postBody, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`OAuth callback failed with status ${res.statusCode}: ${res.body}`));
                    return;
                }
                const accessToken = JSON.parse(res.body);
                accessToken.created_at = Date.now();
                this.tokenJson = JSON.stringify(accessToken, null, 2);
                this.saveTokensToFile(accessToken, this.realmId);
                console.log('OAuth flow completed successfully - tokens saved');
                resolve();
            });
        });
    }
    async handleWebhook(req, body) {
        const webhookPayload = JSON.stringify(body);
        console.log('The payload is:', JSON.stringify(body));
        const signature = req.get('intuit-signature');
        if (!signature) {
            return { status: 401, message: 'FORBIDDEN' };
        }
        if (!webhookPayload) {
            return { status: 200, message: 'success' };
        }
        const hash = crypto.createHmac('sha256', this.config.webhooksVerifier)
            .update(webhookPayload)
            .digest('base64');
        if (signature === hash) {
            console.log('The Webhook notification payload is:', webhookPayload);
            await this.processWebhookNotifications(body);
            return { status: 200, message: 'SUCCESS' };
        }
        return { status: 401, message: 'FORBIDDEN' };
    }
    async ensureValidTokens() {
        if (!this.tokenJson) {
            console.log('No tokens available, cannot fetch entity data');
            return;
        }
        try {
            const currentTokens = JSON.parse(this.tokenJson);
            if (!this.areTokensValid(currentTokens)) {
                console.log('Current tokens are expired, attempting refresh...');
                if (currentTokens.refresh_token) {
                    const refreshedTokens = await this.refreshAccessToken(currentTokens.refresh_token);
                    if (refreshedTokens) {
                        this.tokenJson = JSON.stringify(refreshedTokens, null, 2);
                        this.saveTokensToFile(refreshedTokens, this.realmId);
                        console.log('Tokens refreshed successfully');
                    }
                    else {
                        console.log('Token refresh failed, will skip API calls');
                        this.tokenJson = null;
                    }
                }
                else {
                    console.log('No refresh token available, need new OAuth flow');
                    this.tokenJson = null;
                }
            }
            else {
                console.log('Current tokens are still valid');
            }
        }
        catch (error) {
            console.error('Error validating tokens:', error.message);
            this.tokenJson = null;
        }
    }
    async processWebhookNotifications(body) {
        const enrichedNotifications = [];
        for (const eventNotification of body.eventNotifications) {
            const entities = eventNotification.dataChangeEvent.entities;
            const realmID = eventNotification.realmId;
            for (const entity of entities) {
                const baseNotification = {
                    realmId: realmID,
                    name: entity.name,
                    id: entity.id,
                    operation: entity.operation,
                    lastUpdated: entity.lastUpdated,
                    entityType: entity.name,
                    fetchStatus: 'skipped'
                };
                console.log('Token JSON:', this.tokenJson ? 'Available' : 'undefined');
                await this.ensureValidTokens();
                if (entity.operation !== 'Delete' && this.tokenJson) {
                    try {
                        const fullData = await this.fetchEntityData(entity.name, entity.id, realmID);
                        baseNotification.fullData = fullData;
                        baseNotification.fetchStatus = 'success';
                        console.log(`Successfully fetched full data for ${entity.name} ID: ${entity.id}`);
                        if (entity.name === 'Invoice') {
                            await this.submitInvoiceToFirs(fullData, entity.operation);
                        }
                    }
                    catch (error) {
                        baseNotification.fetchStatus = 'failed';
                        baseNotification.errorMessage = error.message;
                        console.error(`Failed to fetch full data for ${entity.name} ID: ${entity.id}`, error.message);
                    }
                }
                else if (entity.operation === 'Delete') {
                    baseNotification.fetchStatus = 'skipped';
                    console.log(`Skipped fetching data for deleted ${entity.name} ID: ${entity.id}`);
                    if (entity.name === 'Invoice') {
                        await this.handleDeletedInvoiceInFirs(entity.id);
                    }
                }
                enrichedNotifications.push(baseNotification);
                console.log('Enriched notification:', baseNotification);
            }
        }
        await this.writeEnrichedNotificationsToCsv(enrichedNotifications);
    }
    async fetchEntityData(entityName, entityId, realmId) {
        if (!this.tokenJson) {
            throw new Error('No access token available');
        }
        const token = JSON.parse(this.tokenJson);
        const qbo = new QuickBooks(this.config.clientId, this.config.clientSecret, token.access_token, false, realmId, true, true, 4, '2.0', token.refresh_token);
        return new Promise((resolve, reject) => {
            const entityMethods = {
                'Customer': 'getCustomer',
                'Item': 'getItem',
                'Invoice': 'getInvoice',
                'Payment': 'getPayment',
                'Bill': 'getBill',
                'Vendor': 'getVendor',
                'Employee': 'getEmployee',
                'Account': 'getAccount',
                'Class': 'getClass',
                'Department': 'getDepartment',
                'Estimate': 'getEstimate',
                'PurchaseOrder': 'getPurchaseOrder',
                'SalesReceipt': 'getSalesReceipt',
                'TimeActivity': 'getTimeActivity',
                'JournalEntry': 'getJournalEntry'
            };
            const methodName = entityMethods[entityName];
            if (!methodName || typeof qbo[methodName] !== 'function') {
                reject(new Error(`Unsupported entity type: ${entityName}`));
                return;
            }
            qbo[methodName](entityId, (err, data) => {
                if (err) {
                    reject(new Error(`QuickBooks API error: ${err.message || err}`));
                }
                else {
                    resolve(data);
                }
            });
        });
    }
    async writeEnrichedNotificationsToCsv(notifications) {
        const fields = [
            'realmId', 'entityType', 'id', 'operation', 'lastUpdated',
            'fetchStatus', 'errorMessage', 'fullDataJSON'
        ];
        const newLine = '\r\n';
        const csvData = notifications.map(notification => ({
            realmId: notification.realmId,
            entityType: notification.entityType,
            id: notification.id,
            operation: notification.operation,
            lastUpdated: notification.lastUpdated,
            fetchStatus: notification.fetchStatus,
            errorMessage: notification.errorMessage || '',
            fullDataJSON: notification.fullData ? JSON.stringify(notification.fullData) : ''
        }));
        const toCsv = {
            data: csvData,
            fields: fields
        };
        try {
            await fs.promises.stat('file.csv');
            const csv = json2csv(toCsv) + newLine;
            await fs.promises.appendFile('file.csv', csv);
            console.log('Enriched notification data appended to CSV file');
        }
        catch (err) {
            console.log('Creating new CSV file with enriched data headers');
            const headerLine = fields.join(',') + newLine;
            await fs.promises.writeFile('file.csv', headerLine);
            if (csvData.length > 0) {
                const csv = json2csv(toCsv) + newLine;
                await fs.promises.appendFile('file.csv', csv);
            }
        }
    }
    async writeNotificationToCsv(body) {
        const fields = ['realmId', 'name', 'id', 'operation', 'lastUpdated'];
        const newLine = '\r\n';
        const appendThis = [];
        for (let i = 0; i < body.eventNotifications.length; i++) {
            const entities = body.eventNotifications[i].dataChangeEvent.entities;
            const realmID = body.eventNotifications[i].realmId;
            for (let j = 0; j < entities.length; j++) {
                const notification = {
                    realmId: realmID,
                    name: entities[j].name,
                    id: entities[j].id,
                    operation: entities[j].operation,
                    lastUpdated: entities[j].lastUpdated
                };
                appendThis.push(notification);
            }
        }
        const toCsv = {
            data: appendThis,
            fields: fields
        };
        try {
            await fs.promises.stat('file.csv');
            const csv = json2csv(toCsv) + newLine;
            await fs.promises.appendFile('file.csv', csv);
            console.log('The "data to append" was appended to file!');
        }
        catch (err) {
            console.log('New file, just writing headers');
            const headerLine = fields.join(',') + newLine;
            await fs.promises.writeFile('file.csv', headerLine);
        }
    }
    async createCustomer(displayName) {
        const token = JSON.parse(this.tokenJson);
        const qbo = new QuickBooks(this.config.clientId, this.config.clientSecret, token.access_token, false, this.realmId, true, true, 4, '2.0', token.refresh_token);
        return new Promise((resolve, reject) => {
            qbo.createCustomer({ DisplayName: displayName }, (err, customer) => {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    console.log('The response is:', JSON.stringify(customer, null, 2));
                    resolve(customer);
                }
            });
        });
    }
    async submitInvoiceToFirs(invoiceData, operation) {
        try {
            console.log(`Submitting invoice to FIRS: ${invoiceData.Id}, Operation: ${operation}`);
            let firsResponse;
            if (operation === 'Create') {
                firsResponse = await this.firsService.submitInvoice(invoiceData);
            }
            else if (operation === 'Update') {
                firsResponse = await this.firsService.submitInvoice(invoiceData);
            }
            if (firsResponse && firsResponse.code >= 200 && firsResponse.code < 300) {
                console.log(`FIRS submission successful: ${firsResponse.reference || firsResponse.message}`);
            }
            else {
                console.error(`FIRS submission failed: ${firsResponse?.message || 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error(`Error submitting invoice to FIRS:`, error.message);
        }
    }
    async handleDeletedInvoiceInFirs(invoiceId) {
        try {
            console.log(`Handling deleted invoice in FIRS: ${invoiceId}`);
            console.log(`Invoice ${invoiceId} was deleted - would need to cancel in FIRS with proper IRN`);
        }
        catch (error) {
            console.error(`Error handling deleted invoice in FIRS:`, error.message);
        }
    }
    async testWebhookProcessing(body) {
        console.log('Testing webhook processing with FIRS integration...');
        await this.processWebhookNotifications(body);
    }
};
exports.QuickBooksService = QuickBooksService;
exports.QuickBooksService = QuickBooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [firs_service_1.FirsService])
], QuickBooksService);
//# sourceMappingURL=quickbooks.service.js.map