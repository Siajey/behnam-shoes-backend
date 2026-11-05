import { User } from '@api/users/domain'

export default interface IMessageSender {
  /* eslint-disable no-unused-vars */
  send(
    subject: string,
    to: User[],
    path: string,
    replacements: { [key: string]: string },
  ): Promise<void>
}
