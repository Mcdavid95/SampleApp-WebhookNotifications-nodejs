import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [CompanyController],
})
export class CompanyModule {}