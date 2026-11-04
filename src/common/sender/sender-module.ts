import {Module} from '@nestjs/common'

import {SMS_SERVICE} from "@common/di";

import {SMSService} from './sms'

@Module({
    providers: [{
        provide: SMS_SERVICE,
        useClass: SMSService
    }],
    exports: [SMS_SERVICE],
})
export default class SenderModule {
}
