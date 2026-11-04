import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    index,
} from 'drizzle-orm/pg-core'

export const otpCodes = pgTable(
    'otp_codes',
    {
        id: uuid('id').defaultRandom().primaryKey(),

        phoneNumber: varchar('phone_number', {
            length: 20,
        }).notNull(),

        codeHash: text('code_hash').notNull(),

        expiresAt: timestamp('expires_at', {
            withTimezone: true,
            mode: 'date',
        }).notNull(),

        used: boolean('used').default(false).notNull(),

        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'date',
        })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('otp_codes_phone_created_idx').on(
            table.phoneNumber,
            table.createdAt,
        ),
    ],
)

export type OtpCode = typeof otpCodes.$inferSelect
export type NewOtpCode = typeof otpCodes.$inferInsert