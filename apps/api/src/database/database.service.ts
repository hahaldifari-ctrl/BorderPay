import { Injectable } from '@nestjs/common';
import { db } from 'database';

@Injectable()
export class DatabaseService {
  readonly client = db;
}
