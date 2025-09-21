import { Module } from '@nestjs/common';
import { QuickBooksService } from './quickbooks.service';

@Module({
  providers: [QuickBooksService],
  exports: [QuickBooksService],
})
export class QuickBooksModule {}