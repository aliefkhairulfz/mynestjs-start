type EmailVerificationParams = {
    redirectUrl: string;
    email: string;
};

export default function createTemplateEmailVerification(params: EmailVerificationParams): string {
    const { redirectUrl, email } = params;

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Verify your email</title>
                <style>
                    *, *::before, *::after {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        background-color: #ffffff;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #37352f;
                        -webkit-font-smoothing: antialiased;
                        padding: 64px 24px;
                    }

                    .wrapper {
                        max-width: 480px;
                        margin: 0 auto;
                    }

                    .logo {
                        font-size: 14px;
                        font-weight: 600;
                        letter-spacing: -0.01em;
                        margin-bottom: 48px;
                    }

                    h1 {
                        font-size: 22px;
                        font-weight: 600;
                        letter-spacing: -0.02em;
                        line-height: 1.3;
                        margin-bottom: 12px;
                    }

                    .subtitle {
                        font-size: 14px;
                        color: #787774;
                        line-height: 1.7;
                        margin-bottom: 32px;
                    }

                    .btn {
                        display: inline-block;
                        background-color: #f1f1ef;
                        color: #37352f;
                        text-decoration: none;
                        font-size: 13px;
                        font-weight: 500;
                        padding: 9px 18px;
                        border-radius: 5px;
                        letter-spacing: -0.01em;
                    }

                    .divider {
                        border: none;
                        border-top: 1px solid #e9e9e7;
                        margin: 36px 0;
                    }

                    .fallback-label {
                        font-size: 11px;
                        font-weight: 500;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: #9b9a97;
                        margin-bottom: 6px;
                    }

                    .fallback-url {
                        font-size: 12px;
                        color: #9b9a97;
                        word-break: break-all;
                        line-height: 1.6;
                        text-decoration: none;
                    }

                    .footer {
                        margin-top: 48px;
                        font-size: 12px;
                        color: #9b9a97;
                        line-height: 1.7;
                    }
                </style>
            </head>
            <body>
                <div class="wrapper">

                    <div class="logo">NestJs Backend</div>

                    <h1>Verify your email</h1>
                    <p class="subtitle">
                        We sent this link to <strong style="color:#37352f; font-weight:500;">${email}</strong>.
                        Confirm your address to activate your account.
                    </p>

                    <a href="${redirectUrl}" class="btn">Verify email</a>

                    <hr class="divider" />

                    <p class="fallback-label">Or copy this link</p>
                    <a href="${redirectUrl}" class="fallback-url">${redirectUrl}</a>

                    <p class="footer">
                        If you didn't create an account, ignore this email.<br />
                        This link expires in 24 hours.
                    </p>

                </div>
            </body>
            </html>`;
}
