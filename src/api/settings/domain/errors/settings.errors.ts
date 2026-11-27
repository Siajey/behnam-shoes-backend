import { ValidationError } from '@common/errors'

export class InvalidSettingError extends ValidationError {
  constructor(reason: string) {
    super({ message: 'errors.settings.invalid', code: 'SETTING_INVALID', details: { reason } })
  }
}
