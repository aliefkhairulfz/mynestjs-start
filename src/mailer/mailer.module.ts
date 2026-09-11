import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** Token used for injecting the mailer service. */
export const mailerService = 'MailerService';

/** Type alias for the Resend instance used as the mailer service. */
export type MailerService = Resend;

/**
 * Global module for handling email delivery.
 * Provides the Resend instance configured with the application's API key.
 */
@Global()
@Module({
    providers: [
        {
            provide: mailerService,
            inject: [ConfigService],
            useFactory: (c: ConfigService) => {
                const resendApiKey = c.getOrThrow<string>('RESEND_API_KEY');
                const resend = new Resend(resendApiKey);

                console.log('mailer module mounted');
                return resend;
            }
        }
    ],
    exports: [mailerService]
})
export class MailerModule {}
