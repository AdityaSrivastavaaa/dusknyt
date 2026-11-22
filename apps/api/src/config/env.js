
import 'dotenv/config';

export const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

export const env = {
  port: +process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',

  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,http://localhost:5175'
  ).split(',').map((s) => s.trim()),

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT) || 465,
  smtpSecure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT || 465) === 465,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `DUSKNYT <${process.env.SMTP_USER}>` : ''),
  userAppUrl: process.env.USER_APP_URL || 'https://dusknyt-mdqh.vercel.app',
  promoterAppUrl: process.env.PROMOTER_APP_URL || 'https://dusknyt-promoter.vercel.app',

  // Temporary production OTP testing
  otpTestMode: process.env.OTP_TEST_MODE === 'true',

  otpTestPhones: (process.env.OTP_TEST_PHONES || '')
    .split(',')
    .map((phone) => phone.trim())
    .filter(Boolean),
};
