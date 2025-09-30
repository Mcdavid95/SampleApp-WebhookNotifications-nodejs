import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BankStatementService } from './bank-statement.service';

@Controller('bank-statement')
export class BankStatementController {
  constructor(private readonly bankStatementService: BankStatementService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBankStatement(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId') companyId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type (Excel files)
    const allowedMimeTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Please upload an Excel file (.xls, .xlsx)',
      );
    }

    return this.bankStatementService.uploadBankStatement(file, companyId);
  }
}