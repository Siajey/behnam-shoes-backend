import { resolveAssetPath } from '@common/util'
import { User } from '@api/users/domain'
import { ConfigProvider } from '@common/configuration'
import { EmailService } from '@common/sender'

export const sendConfirmationLinkHelper = (
  user: User,
  token: string,
  configProvider: ConfigProvider,
  emailService: EmailService,
): Promise<object> => {
  const confirmLink = `${configProvider.get('FRONT_END_CONFIRM_EMAIL_ENDPOINT')}/${token}`
  const companyName = configProvider.get('COMPANY_NAME')
  const companyEmail = configProvider.get('COMPANY_EMAIL')
  return emailService.send(
    'Email Confirmation',
    [user],
    resolveAssetPath('email', 'confirm-email-template.html'),
    {
      Company_Name: companyName,
      User_Name: user.email,
      Confirm_Link: confirmLink,
      Company_Email_Address: companyEmail,
    },
  )
}
