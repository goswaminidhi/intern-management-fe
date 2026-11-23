import { getApiBaseUrl } from './axios';

const BASE_URL = getApiBaseUrl();

const ENDPOINTS = {
  request: `${BASE_URL}/forgot-password`,
  verify: `${BASE_URL}/verify-reset-otp`,
  reset: `${BASE_URL}/reset-password`,
};

// Maps the error codes thrown by the backend service to messages people can act on.
const ERROR_MESSAGES = {
  INVALID_OTP: 'That code is incorrect. Check the email and try again.',
  OTP_EXPIRED: 'This code has expired. Request a new one.',
  OTP_ALREADY_VERIFIED: 'This code was already used. Request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many incorrect attempts. Request a new code.',
  INVALID_RESET_TOKEN: 'This reset session is no longer valid. Start again.',
  RESET_TOKEN_EXPIRED: 'Your reset session expired. Start again.',
  USER_NOT_FOUND: 'We could not find this account. Start again.',
};

export class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function post(url, body) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. Check your connection and try again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Adjust if your API returns errors in a different shape.
    const raw = data.code ?? data.error ?? data.message ?? 'UNKNOWN';
    throw new ApiError(raw, ERROR_MESSAGES[raw] ?? (raw === 'UNKNOWN' ? 'Something went wrong. Try again.' : raw));
  }
  return data;
}

export const requestPasswordReset = (email) => post(ENDPOINTS.request, { email });

export const verifyResetOtp = (email, otp) => post(ENDPOINTS.verify, { email, otp });

export const resetPassword = (resetToken, newPassword, confirmPassword) =>
  post(ENDPOINTS.reset, { resetToken, newPassword,  confirmPassword});