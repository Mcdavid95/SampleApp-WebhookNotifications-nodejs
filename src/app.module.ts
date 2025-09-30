import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QuickBooksModule } from './quickbooks/quickbooks.module';
import { FirsModule } from './firs/firs.module';
import { CompanyModule } from './company/company.module';
import { BankStatementModule } from './bank-statement/bank-statement.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'views'),
      serveRoot: '/',
    }),
    QuickBooksModule,
    FirsModule,
    CompanyModule,
    BankStatementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}