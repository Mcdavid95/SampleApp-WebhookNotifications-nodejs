import { Request, Response } from 'express';
import { AppService } from './app.service';
import { QuickBooksService } from './quickbooks/quickbooks.service';
export declare class AppController {
    private readonly appService;
    private readonly quickbooksService;
    constructor(appService: AppService, quickbooksService: QuickBooksService);
    getHome(): Promise<{
        redirect_uri: any;
        token_json: string;
        webhook_uri: any;
        webhook_payload: any;
    }>;
    getAuthUri(session: any): string;
    handleCallback(req: Request, res: Response): Promise<void>;
    handlePayload(body: any, res: Response): void;
    handleWebhook(req: Request, body: any, res: Response): Promise<void>;
    createCustomer(body: {
        displayName: string;
    }, res: Response): Promise<void>;
    setTokensForTesting(body: {
        accessToken: string;
        refreshToken: string;
        realmId: string;
    }, res: Response): void;
    startOAuthFlow(res: Response): void;
    testFirsIntegration(req: Request, res: Response): Promise<void>;
}
