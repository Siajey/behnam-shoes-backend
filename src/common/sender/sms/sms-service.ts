import { Injectable } from '@nestjs/common'

import { User } from '@api/users/domain'

import IMessageSender from '../i-message-sender'

@Injectable()
export default class SMSService implements IMessageSender {
  constructor() {}

  async send(
    subject: string,
    to: User[],
    path: string,
    replacements: { [p: string]: string },
  ): Promise<void> {
  }
}
