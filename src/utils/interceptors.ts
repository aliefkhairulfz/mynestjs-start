import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type PipeData<D, M> = {
    message: string;
    data: D;
    meta: M;
};

/**
 * Intercepts successful responses and wraps them in a consistent JSON structure.
 * Standardizes the shape of success responses across the application.
 */
@Injectable()
export class HttpResponseInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const response = ctx.getResponse<Response>();

        return next.handle().pipe(
            map((data: PipeData<any, any>) => {
                const responseData = data.data ?? {};
                const responseMeta = data.meta ?? {};
                const responseMessage = data.message ?? 'success';

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
