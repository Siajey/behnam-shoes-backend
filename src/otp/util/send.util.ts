import {randomInt} from 'node:crypto'

import {User} from "@api/users/domain";
import {generateOtpMessageFa, SMSService} from "@common/sender";
import {ConfigProvider} from "@common/configuration";

export const sendOTPSMS = (user: User, otp: string, smsService: SMSService, configProvider: ConfigProvider) => {
    const message = generateOtpMessageFa(
        otp,
        configProvider.get('COMPANY_NAME'),
        configProvider.get('FRONTEND_URL'),
    )
    return smsService.send(
        'OTP',
        [user],
        message,
        {},
    )
}


export const generateOtpCode = (): string => {
    return randomInt(100000, 1_000_000).toString()
}