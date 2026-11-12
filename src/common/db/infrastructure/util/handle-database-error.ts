import {HttpStatus} from '@nestjs/common'
import {I18nService} from 'nestjs-i18n'
import {DrizzleQueryError} from 'drizzle-orm'

import {ApiResponse} from '@common/api'
import {ILogger} from '@common/logger'
import {ConflictError, ValidationError} from "@common/errors";
import { extractPostgresError } from "./extract-postgres-error-from-drizzle"

enum PostgresErrorCode {
    UNIQUE_VIOLATION = '23505',
    FOREIGN_KEY_VIOLATION = '23503',
    NOT_NULL_VIOLATION = '23502',
    CHECK_VIOLATION = '23514',
    INVALID_TEXT_REPRESENTATION = '22P02',
    UNDEFINED_TABLE = '42P01',
}

interface PgErrorLike {
    code?: string
    message?: string
    detail?: string
    constraint?: string
    column?: string
    table?: string
}

export const handleDatabaseError = (
    apiRes: ApiResponse,
    lang: string,
    i18n: I18nService,
    err: DrizzleQueryError,
    logger: ILogger,
    userId?: string,
): ApiResponse => {
    const pgError = extractPostgresError(err);

    if (!pgError) {
        logDatabaseError(logger, 'error', 'db.exception', err, undefined, userId);
        return internalErrorResponse(apiRes, i18n, lang);
    }

    const {code} = pgError;

    switch (code) {
        case PostgresErrorCode.UNIQUE_VIOLATION: {
            logDatabaseError(logger, 'warn', 'db.constraint', err, pgError, userId);

            const error = new ConflictError({
                message: 'errors.db.duplicateEntry',
                details: {
                    path: extractDuplicateFieldName(pgError),
                }
            });

            return errorResponse(
                apiRes,
                i18n.t(error.message, {
                    lang,
                    args: error.details,
                }),
                error.code,
                error.status,
            );
        }

        case PostgresErrorCode.FOREIGN_KEY_VIOLATION: {
            logDatabaseError(logger, 'warn', 'db.constraint', err, pgError, userId);

            const error = new ConflictError({
                message: 'errors.db.foreignKeyConflict',
            });

            return errorResponse(
                apiRes,
                i18n.t(error.message, {lang}),
                error.code,
                error.status,
            );
        }

        case PostgresErrorCode.NOT_NULL_VIOLATION:
        case PostgresErrorCode.CHECK_VIOLATION:
        case PostgresErrorCode.INVALID_TEXT_REPRESENTATION: {
            logDatabaseError(logger, 'warn', 'db.constraint', err, pgError, userId);

            const error = new ValidationError(
                {
                    message: 'errors.validation.invalidFieldValue',
                });

            return errorResponse(
                apiRes,
                i18n.t(error.message, {lang}),
                error.code,
                error.status,
            );
        }

        case PostgresErrorCode.UNDEFINED_TABLE: {
            logDatabaseError(logger, 'error', 'db.exception', err, pgError, userId);

            return internalErrorResponse(apiRes, i18n, lang);
        }

        default: {
            logDatabaseError(logger, 'error', 'db.exception', err, pgError, userId);

            return internalErrorResponse(apiRes, i18n, lang);
        }
    }
};

export const errorResponse = (
    apiRes: ApiResponse,
    message: string,
    code: string,
    status: HttpStatus,
): ApiResponse => ({
    ...apiRes,
    status,
    messageObj: {message},
    code,
});

const internalErrorResponse = (
    apiRes: ApiResponse,
    i18n: I18nService,
    lang: string,
): ApiResponse => ({
    ...apiRes,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    messageObj: {
        message: i18n.t('errors.internalServerError', {lang}),
    },
})

const extractDuplicateFieldName = (err?: PgErrorLike): string => {
    const detail = err?.['detail']
    if (!detail) return ''

    const match = detail.match(/Key \(([^)]+)\)=/)
    return match ? match[1] : ''
}

const logDatabaseError = (
    logger: ILogger,
    level: 'warn' | 'error',
    event: 'db.constraint' | 'db.exception',
    err: DrizzleQueryError,
    pgError: PgErrorLike | undefined,
    userId?: string,
) => {
    logger[level](err.message, {
        module: 'DatabaseExceptionHandler',
        event,
        operation: 'query',
        userId,
        err,
        data: {
            code: pgError?.code,
            constraint: pgError?.constraint,
            table: pgError?.table,
            column: pgError?.column,
            detail: pgError?.detail,
        },
    })
}
