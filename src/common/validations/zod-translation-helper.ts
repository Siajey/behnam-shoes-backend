import { ZodIssue } from 'zod'
import { I18nService } from 'nestjs-i18n'

export const translateZodMessages = (
    i18n: I18nService,
    issues: ZodIssue[],
    lang: string,
): string[] => {
    const translate = (
        message: string,
        args: Record<string, unknown>,
    ): string => {
        const result = i18n.t(message, { args, lang })
        return typeof result === 'string' ? result : String(result ?? message)
    }

    return issues.map((issue) => {
        const issuePath = issue.path
            .filter((_, index) => {
                if (issues.length < 2) return true
                return index % 2 === 0
            })
            .join('.')

        switch (issue.code) {
            case 'too_big':
                return translate(issue.message, {
                    path: issuePath,
                    maxLength: issue.maximum,
                })

            case 'too_small':
                return translate(issue.message, {
                    path: issuePath,
                    minLength: issue.minimum,
                })

            default: {
                const message = translate(issue.message, {
                    path: issuePath,
                })

                if (
                    message.includes(issuePath) ||
                    issuePath.startsWith('fields')
                ) {
                    return message
                }

                return `${issuePath}: ${message}`
            }
        }
    })
}