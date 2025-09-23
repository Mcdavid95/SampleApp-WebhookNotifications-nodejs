import { Module } from '@nestjs/common';
import { FirsService } from './firs.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [FirsService],
  exports: [FirsService],
})
export class FirsModule {}