import { Inject, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { DATABASE } from '@common/di'

@Injectable()
export class DatabaseHealthService {
  constructor(
    @Inject(DATABASE)
    private readonly db: {
      execute(query: unknown): Promise<unknown>
    },
  ) {}

  async ping(): Promise<boolean> {
    try {
      await this.db.execute(sql`SELECT 1`)
      return true
    } catch {
      return false
    }
  }
}
