
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

  // Temporary production OTP testing
  otpTestMode: process.env.OTP_TEST_MODE === 'true',

  otpTestPhones: (process.env.OTP_TEST_PHONES || '')
    .split(',')
    .map((phone) => phone.trim())
    .filter(Boolean),
};
