import { Controller, Get, Post, Body, Render, Req, Res, Session, Query } from '@nestjs/common';
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

  @Post('testFirs')
  async testFirsIntegration(@Req() req: Request, @Res() res: Response) {
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

      // Directly test the webhook processing without signature verification
      await this.quickbooksService.testWebhookProcessing(sampleWebhook);

      res.json({
        message: 'Test FIRS integration completed',
        note: 'Check server logs for FIRS submission details. Since QB API tokens may be invalid, FIRS calls may show errors, but the integration flow works.',
        samplePayload: sampleWebhook
      });
    } catch (error) {
      res.status(500).json({
        error: 'Test failed',
        details: error.message
      });
    }
  }

  @Get('custom-fields')
  async getCustomFields(
    @Query('realmId') realmId?: string,
    @Query('entityType') entityType?: string,
    @Res() res?: Response
  ) {
    try {
      const customFields = await this.quickbooksService.getCustomFieldDefinitions(realmId, entityType);

      if (res) {
        res.json({
          success: true,
          data: customFields,
          message: `Found ${customFields.length} custom field definitions`
        });
      }

      return {
        success: true,
        data: customFields,
        message: `Found ${customFields.length} custom field definitions`
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error.message,
        message: 'Failed to fetch custom field definitions'
      };

      if (res) {
        res.status(500).json(errorResponse);
        return;
      }

      return errorResponse;
    }
  }

  @Get('custom-fields/invoice')
  async getInvoiceCustomFields(
    @Query('realmId') realmId?: string,
    @Res() res?: Response
  ) {
    try {
      const customFields = await this.quickbooksService.getInvoiceCustomFieldDefinitions(realmId);

      if (res) {
        res.json({
          success: true,
          data: customFields,
          message: `Found ${customFields.length} invoice custom field definitions`
        });
      }

      return {
        success: true,
        data: customFields,
        message: `Found ${customFields.length} invoice custom field definitions`
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error.message,
        message: 'Failed to fetch invoice custom field definitions'
      };

      if (res) {
        res.status(500).json(errorResponse);
        return;
      }

      return errorResponse;
    }
  }
}