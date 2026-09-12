import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type ResponseFromPipe<D, M> = {
    message: string;
    data: D;
    meta: M;
};

/**
 * Intercepts successful responses and wraps them in a consistent JSON structure.
 * Standardizes the shape of success responses across the application.
 */

export const SKIP_RESPONSE_INTERCEPTOR = 'skipResponseInterceptor';
export const SkipResponseInterceptor = () => SetMetadata(SKIP_RESPONSE_INTERCEPTOR, true);

@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const isSkipInterceptor = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_INTERCEPTOR, [context.getHandler(), context.getClass()]);
        if (isSkipInterceptor) return next.handle();

        const ctx = context.switchToHttp();
        const response = ctx.getResponse<Response>();

        return next.handle().pipe(
            map((responseFromPipe: ResponseFromPipe<any, any>) => {
                const responseData = responseFromPipe.data ?? {};
                const responseMeta = responseFromPipe.meta ?? {};
                const responseMessage = responseFromPipe.message ?? 'success';

                return {
                    ok: true,
                    statusCode: response.statusCode,
                    message: responseMessage,
                    data: responseData,
                    meta: responseMeta
                };
            })
        );
    }
}
