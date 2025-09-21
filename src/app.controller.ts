import { Controller, Get, Post, Body, Render, Req, Res, Session } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppService } from './app.service';
import { QuickBooksService } from './quickbooks/quickbooks.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly quickbooksService: QuickBooksService,
  ) {}

  @Get()
  @Render('index')
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

  @Get('authUri')
  getAuthUri(@Session() session: any): string {
    return this.quickbooksService.generateAuthUrl(session);
  }

  @Get('callback')
  async handleCallback(@Req() req: Request, @Res() res: Response) {
    await this.quickbooksService.handleCallback(req);
    res.send('');
  }

  @Post('payload')
  handlePayload(@Body() body: any, @Res() res: Response) {
    console.log('The Webhook notification payload is:', JSON.stringify(body));
    res.sendStatus(200);
  }

  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Body() body: any, @Res() res: Response) {
    const result = await this.quickbooksService.handleWebhook(req, body);
    res.status(result.status).send(result.message);
  }

  @Post('createCustomer')
  async createCustomer(@Body() body: { displayName: string }, @Res() res: Response) {
    const customer = await this.quickbooksService.createCustomer(body.displayName);
    res.send(customer);
  }

  @Post('setTokens')
  setTokensForTesting(@Body() body: { accessToken: string; refreshToken: string; realmId: string }, @Res() res: Response) {
    this.quickbooksService.setTokensForTesting(body.accessToken, body.refreshToken, body.realmId);
    res.send({ message: 'Tokens set successfully. Webhooks will now fetch full data.' });
  }

  @Get('startOAuth')
  startOAuthFlow(@Res() res: Response) {
    const authUrl = this.quickbooksService.generateAuthUrl({});
    res.json({
      message: 'Click the link below to authorize with QuickBooks',
      authUrl: authUrl,
      instructions: 'After authorization, you will be redirected back and tokens will be automatically saved.'
    });
  }
}