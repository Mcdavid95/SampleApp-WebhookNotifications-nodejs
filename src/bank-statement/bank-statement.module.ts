import { Module } from '@nestjs/common';
import { BankStatementController } from './bank-statement.controller';
import { BankStatementService } from './bank-statement.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { FileProcessorService } from './file-processor.service';
import { RowProcessorService } from './row-processor.service';
import { FirsService } from '../firs/firs.service';

@Module({
  controllers: [BankStatementController],
  providers: [
    BankStatementService,
    SupabaseService,
    RabbitMQService,
    FileProcessorService,
    RowProcessorService,
    FirsService,
  ],
  exports: [BankStatementService],
})
export class BankStatementModule {}