import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { FirsModule } from '../firs/firs.module';

@Module({
  imports: [SupabaseModule, FirsModule],
  controllers: [CompanyController],
})
export class CompanyModule {}