import {DrizzleQueryError} from "drizzle-orm";

interface PostgresError {
    code: string;
    message?: string;
    detail?: string;
    constraint?: string;
    table?: string;
    column?: string;
    schema?: string;
    dataType?: string;
}

interface ErrorWithCause extends Error {
    cause?: unknown;
}

export const extractPostgresError = (
    error: DrizzleQueryError,
): PostgresError | undefined => {
    let cause: unknown = (error as ErrorWithCause).cause;

    while (cause instanceof Error) {
        const current = cause as ErrorWithCause;

        if (
            'code' in current &&
            typeof current.code === 'string'
        ) {
            return current as PostgresError;
        }

        cause = current.cause;
    }

    return undefined;
};