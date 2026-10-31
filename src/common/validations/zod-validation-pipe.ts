import { PipeTransform } from '@nestjs/common'
import { z } from 'zod'

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodType) {}

  transform(value: unknown) {
    return this.schema.parse(value)
  }
}
