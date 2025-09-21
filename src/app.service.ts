import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppService {
  private config: any;

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configFile);
  }

  getConfig() {
    return this.config;
  }

  async initializeCsvFile() {
    const fields = [
      'realmId', 'entityType', 'id', 'operation', 'lastUpdated',
      'fetchStatus', 'errorMessage', 'fullDataJSON'
    ];
    const newLine = '\r\n';
    const headerLine = fields.join(',') + newLine;

    try {
      await fs.promises.writeFile('file.csv', headerLine);
      console.log('CSV file initialized with enhanced headers');
    } catch (error) {
      throw error;
    }
  }
}