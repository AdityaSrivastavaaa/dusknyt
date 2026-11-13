
import { randomInt } from 'node:crypto';
import { isProd, env } from '../config/env.js';

// Temporary in-memory OTP store
const store = new Map();

export function issueOtp(phone) {
  const otp = String(
    isProd ? randomInt(100000, 1000000) : 123456
  );

  store.set(phone, {
    otp,
    exp: Date.now() + 5 * 60 * 1000,
    tries: 0,
  });

  // Show OTP locally, or in production only for approved test numbers.
  const canDisplay =
    !isProd ||
    (env.otpTestMode && env.otpTestPhones.includes(phone));

  if (canDisplay) {
    return otp;
  }

  // SMS integration can be added here later.
  return undefined;
}

export function checkOtp(phone, otp) {
  const record = store.get(phone);

  if (!record || record.exp < Date.now()) {
    store.delete(phone);
    return false;
  }

  if (++record.tries > 5) {
    store.delete(phone);
    return false;
  }

  if (record.otp !== String(otp)) {
    return false;
  }

  store.delete(phone);
  return true;
}
