import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { BankStatementFileMessage } from '../types/bank-statement.types';

@Injectable()
export class BankStatementService {
  private readonly logger = new Logger(BankStatementService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async uploadBankStatement(
    file: Express.Multer.File,
    companyId?: string,
  ): Promise<{ fileUrl: string; message: string }> {
    this.logger.log(`Uploading bank statement: ${file.originalname}`);

    try {
      // Upload file to Supabase storage
      const fileName = `bank-statements/${Date.now()}-${file.originalname}`;
      const fileUrl = await this.supabaseService.uploadFile(
        file.buffer,
        fileName,
        'FIRS-QBO',
        file.mimetype,
      );

      // Create message for RabbitMQ
      const message: BankStatementFileMessage = {
        fileUrl,
        fileName: file.originalname,
        companyId,
        uploadedAt: new Date().toISOString(),
      };

      // Publish to file processing queue
      await this.rabbitMQService.publish('bank-statement-files', message);

      this.logger.log(`Bank statement uploaded and queued: ${fileUrl}`);

      return {
        fileUrl,
        message: 'Bank statement uploaded successfully and queued for processing',
      };
    } catch (error) {
      this.logger.error('Error uploading bank statement:', error);
      throw error;
    }
  }
}