import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

type ExceptionErrorObjectResponse = {
    message: string;
    error: any;
    statusCode: number;
};

/**
 * Global exception filter that catches HttpExceptions and normalizes their JSON response structure.
 * Ensures consistent error formatting across all controllers.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const exceptionStatus = exception.getStatus();
        const errorObject = exception.getResponse() as ExceptionErrorObjectResponse;

        response.status(exceptionStatus).json({
            ok: false,
            statusCode: exceptionStatus,
            message: errorObject.message,
            errors: typeof errorObject.error === 'object' ? errorObject.error : {}
        });
    }
}
