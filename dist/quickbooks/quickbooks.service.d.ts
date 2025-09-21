import { Request } from 'express';
import { WebhookEventNotification } from '../types/quickbooks.types';
import { FirsService } from '../firs/firs.service';
export declare class QuickBooksService {
    private readonly firsService;
    private config;
    private tokenJson;
    private realmId;
    private webhookPayload;
    private csrf;
    constructor(firsService: FirsService);
    setTokensForTesting(accessToken: string, refreshToken: string, realmId: string): void;
    private loadTokensFromFile;
    private saveTokensToFile;
    private areTokensValid;
    private refreshStoredTokens;
    private refreshAccessToken;
    private loadConfig;
    getTokenJson(): string;
    getWebhookPayload(): any;
    generateAuthUrl(session: any): string;
    handleCallback(req: Request): Promise<void>;
    handleWebhook(req: Request, body: WebhookEventNotification): Promise<{
        status: number;
        message: string;
    }>;
    private ensureValidTokens;
    private processWebhookNotifications;
    private fetchEntityData;
    private writeEnrichedNotificationsToCsv;
    private writeNotificationToCsv;
    createCustomer(displayName: string): Promise<any>;
    private submitInvoiceToFirs;
    private handleDeletedInvoiceInFirs;
}
