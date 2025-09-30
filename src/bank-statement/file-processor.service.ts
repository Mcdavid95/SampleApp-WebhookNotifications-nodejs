import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import {
  BankStatementFileMessage,
  BankStatementRow,
  BankStatementRowMessage,
} from '../types/bank-statement.types';
import * as XLSX from 'xlsx';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class FileProcessorService implements OnModuleInit {
  private readonly logger = new Logger(FileProcessorService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async onModuleInit() {
    // Start consuming from the file processing queue
    await this.rabbitMQService.consume(
      'bank-statement-files',
      this.processFile.bind(this),
    );
    this.logger.log('File processor service initialized');
  }

  private async processFile(message: BankStatementFileMessage): Promise<void> {
    this.logger.log(`Processing file: ${message.fileName}`);

    try {
      // Download file from URL
      const fileBuffer = await this.downloadFile(message.fileUrl);

      // Parse Excel file
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: BankStatementRow[] = XLSX.utils.sheet_to_json(firstSheet);

      this.logger.log(`Found ${rows.length} rows in file ${message.fileName}`);

      // Send each row to the row processing queue
      for (let i = 0; i < rows.length; i++) {
        const rowMessage: BankStatementRowMessage = {
          row: rows[i],
          rowNumber: i + 1,
          fileName: message.fileName,
          fileUrl: message.fileUrl,
          companyId: message.companyId,
        };

        await this.rabbitMQService.publish('bank-statement-rows', rowMessage);
      }

      this.logger.log(
        `Successfully queued ${rows.length} rows from ${message.fileName}`,
      );
    } catch (error) {
      this.logger.error(`Error processing file ${message.fileName}:`, error);
      throw error;
    }
  }

  private async downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }
}