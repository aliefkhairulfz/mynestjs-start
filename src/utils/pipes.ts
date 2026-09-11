import { BadRequestException, Injectable, ValidationError, ValidationPipe } from '@nestjs/common';

/**
 * Custom validation pipe that transforms payload objects and strips non-whitelisted properties.
 * Also maps nested class-validator errors into a flat, readable map for the client.
 */
@Injectable()
export class HttpCustomValidationPipe extends ValidationPipe {
    constructor() {
        super({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true
        });
    }

    public override createExceptionFactory() {
        return function (validationErrors?: ValidationError[]) {
            const errorEntries = new Map();

            function recursiveErrorTracer(errors: ValidationError[], parentPath = '') {
                errors.forEach(error => {
                    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
                    if (error.constraints) errorEntries.set(path, Object.values(error.constraints));
                    if (error.children && error.children.length > 0) recursiveErrorTracer(error.children, path);
                });
            }

            if (validationErrors) {
                recursiveErrorTracer(validationErrors);
                return new BadRequestException({ message: 'Validation Failed', error: Object.fromEntries(errorEntries), statusCode: 400 });
            }
        };
    }
}
