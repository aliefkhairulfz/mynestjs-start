type EmailVerificationParams = {
    otp: string;
    email: string;
};

export default function createTemplateEmailVerification(params: EmailVerificationParams): string {
    const { otp, email } = params;

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

                    .otp-container {
                        background-color: #f1f1ef;
                        padding: 16px 24px;
                        border-radius: 8px;
                        margin-bottom: 32px;
                        text-align: center;
                    }

                    .otp-code {
                        font-size: 32px;
                        font-weight: 700;
                        letter-spacing: 0.1em;
                        color: #37352f;
                    }

                    .divider {
                        border: none;
                        border-top: 1px solid #e9e9e7;
                        margin: 36px 0;
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
                        We sent this code to <strong style="color:#37352f; font-weight:500;">${email}</strong>.
                        Enter it to activate your account.
                    </p>

                    <div class="otp-container">
                        <div class="otp-code">${otp}</div>
                    </div>

                    <hr class="divider" />

                    <p class="footer">
                        If you didn't create an account, ignore this email.<br />
                        This code expires in 15 minutes.
                    </p>

                </div>
            </body>
            </html>`;
}
