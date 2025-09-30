import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { FirsService } from '../firs/firs.service';
import { BankStatementRowMessage } from '../types/bank-statement.types';

@Injectable()
export class RowProcessorService implements OnModuleInit {
  private readonly logger = new Logger(RowProcessorService.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly firsService: FirsService,
  ) {}

  async onModuleInit() {
    // Start consuming from the row processing queue
    await this.rabbitMQService.consume(
      'bank-statement-rows',
      this.processRow.bind(this),
    );
    this.logger.log('Row processor service initialized');
  }

  private async processRow(message: BankStatementRowMessage): Promise<void> {
    this.logger.log(
      `Processing row ${message.rowNumber} from file ${message.fileName}`,
    );

    try {
      // Example: Process the row data and send to FIRS service
      // You'll need to customize this based on your business logic

      // Log the row data
      this.logger.log(`Row data: ${JSON.stringify(message.row)}`);

      // Example: Transform bank statement row to invoice data and submit to FIRS
      // This is a placeholder - you'll need to implement your actual business logic
      if (this.shouldProcessRow(message.row)) {
        await this.sendToFirs(message);
        this.logger.log(
          `Successfully processed row ${message.rowNumber} from ${message.fileName}`,
        );
      } else {
        this.logger.log(
          `Skipped row ${message.rowNumber} from ${message.fileName} (does not meet criteria)`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing row ${message.rowNumber} from ${message.fileName}:`,
        error,
      );
      throw error;
    }
  }

  private shouldProcessRow(row: any): boolean {
    // Add your business logic to determine if a row should be processed
    // For example: check if required fields are present, amount is valid, etc.
    return row.amount && row.description;
  }

  private async sendToFirs(message: BankStatementRowMessage): Promise<void> {
    // Implement your logic to transform the bank statement row
    // into an invoice or transaction and submit it to FIRS

    // Example placeholder logic:
    // const invoiceData = this.transformRowToInvoice(message.row);
    // const companyConfig = await this.getCompanyConfig(message.companyId);
    // await this.firsService.submitInvoice(invoiceData, companyConfig);

    this.logger.log(
      `Would send to FIRS: ${JSON.stringify(message.row)}`,
    );
  }
}