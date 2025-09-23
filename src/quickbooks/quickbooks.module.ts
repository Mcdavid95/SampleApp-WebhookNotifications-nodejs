import { Module } from '@nestjs/common';
import { QuickBooksService } from './quickbooks.service';
import { FirsModule } from '../firs/firs.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [FirsModule, SupabaseModule],
  providers: [QuickBooksService],
  exports: [QuickBooksService],
})
export class QuickBooksModule {}