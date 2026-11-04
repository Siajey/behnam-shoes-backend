import {Module} from '@nestjs/common'

import UserModule from '@api/users/user.module'
import {AuthController} from '@api/auth/presentation'
import {AuthProviders} from '@api/auth/infrastructure'
import {CryptoModule} from '@common/security'
import {SenderModule} from '@common/sender'
import {CustomCacheModule} from '@common/cache'
import SessionModule from '@api/session/session.module'
import {OtpModule} from "../../otp";

@Module({
    imports: [
        CustomCacheModule,
        OtpModule,
        SenderModule,
        SessionModule,
        UserModule,
        OtpModule,
    ],
    controllers: [AuthController],
    providers: [...AuthProviders],
})
export default class AuthModule {
}
