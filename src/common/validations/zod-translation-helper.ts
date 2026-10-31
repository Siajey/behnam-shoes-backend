import { ZodIssue } from 'zod'
import { I18nService } from 'nestjs-i18n'

export const translateZodMessages = (
  i18n: I18nService,
  issues: ZodIssue[],
  lang: string,
): string[] => {
  return issues.map((issue) => {
    const issuePath = issue.path
      .filter((_, index) => {
        if (issues.length < 2) return true
        else return index % 2 === 0
      })
      .join('.')
    switch (issue.code) {
      case 'too_big':
        return i18n.t(issue.message, {
          args: { path: issuePath, maxLength: issue.maximum },
          lang,
        })
      case 'too_small':
        return i18n.t(issue.message, {
          args: { path: issuePath, minLength: issue.minimum },
          lang,
        })
      default: {
        const message = i18n.t(issue.message, { args: { path: issuePath }, lang }).toString()
        if (message.includes(issuePath.toString()) || issuePath.toString().startsWith('fields'))
          return message
        else return `${issuePath}: ${message}`
      }
    }
  })
}
