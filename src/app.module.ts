import {Module} from '@nestjs/common'
import {join} from 'path'
import {
    AcceptLanguageResolver,
    CookieResolver,
    HeaderResolver,
    I18nModule,
    QueryResolver,
} from 'nestjs-i18n'
import {ConfigService} from '@nestjs/config'

import {CustomConfigModule} from '@common/configuration'
import {AppLoggerModule} from '@common/logger'
import {GlobalExceptionFilter} from '@common/errors'
import {ApiResponseInterceptor} from '@common/api'
import {CustomThrottlerModule} from '@common/security'
import {DatabaseModule} from '@common/db'
import {AuthModule} from "@api/auth";
import {UserModule} from "@api/users";

@Module({
    imports: [
        CustomConfigModule,
        AppLoggerModule,
        CustomThrottlerModule,
        I18nModule.forRootAsync({
            imports: [CustomConfigModule],
            useFactory: () => ({
                fallbackLanguage: process.env.NODE_ENV === 'test' ? 'en' : 'fa',
                loaderOptions: {
                    path: join(__dirname, './common/i18n'),
                    watch: true,
                },
            }),
            resolvers: [
                {use: QueryResolver, options: ['lang']},
                new QueryResolver(['lang', 'l']),
                new HeaderResolver(['x-custom-lang']),
                new HeaderResolver(['x-lang']),
                new CookieResolver(['NEXT_LOCALE', 'i18n_lang', 'lang', 'locale']),
                new CookieResolver(),
                AcceptLanguageResolver,
            ],
            inject: [ConfigService],
        }),
        DatabaseModule,
        AuthModule,
        UserModule
    ],
    providers: [GlobalExceptionFilter, ApiResponseInterceptor],
})
export class AppModule {
}
