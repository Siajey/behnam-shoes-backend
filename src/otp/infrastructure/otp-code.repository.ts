import {Inject, Injectable} from '@nestjs/common'
import {and, desc, eq} from 'drizzle-orm'

import {CreateOtpInput, IOtpRepository, OtpCode} from "../domain";
import {Database} from "@common/db";
import {DATABASE} from "@common/di";
import * as schema from "./otp-code.model";

@Injectable()
export default class OtpRepository implements IOtpRepository {
    constructor(@Inject(DATABASE) private readonly db: Database<typeof schema>) {
    }

    async create(input: CreateOtpInput): Promise<OtpCode> {
        const [otp] = await this.db
            .insert(schema.otpCodes)
            .values({
                phoneNumber: input.phoneNumber,
                codeHash: input.codeHash,
                expiresAt: input.expiresAt,
            })
            .returning()

        return otp
    }

    async findLatestUnused(
        phoneNumber: string,
    ): Promise<OtpCode | null> {
        const [otp] = await this.db
            .select()
            .from(schema.otpCodes)
            .where(
                and(
                    eq(schema.otpCodes.phoneNumber, phoneNumber),
                    eq(schema.otpCodes.used, false),
                ),
            )
            .orderBy(desc(schema.otpCodes.createdAt))
            .limit(1)

        return otp ?? null
    }

    async delete(id: string): Promise<void> {
        await this.db
            .delete(schema.otpCodes)
            .where(eq(schema.otpCodes.id, id))
    }
}