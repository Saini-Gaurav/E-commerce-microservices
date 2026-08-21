import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthError } from "../services/auth.service";

const isProduction = process.env.NODE_ENV === "production";

// Shared cookie settings. maxAge is in MILLISECONDS for express cookies.
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const API_URL = process.env.API_URL;

/**
 * Puts both tokens on the response as httpOnly cookies. Called after
 * register, login, and refresh — anywhere we issue a fresh token pair.
 */
function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    path: "/", // sent on every request — needed since most routes check it
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    // Only sent to the refresh endpoint itself — minimizes how many
    // places this long-lived, powerful token is ever transmitted to.
    path: `${API_URL}/auth/refresh`,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: `${API_URL}/auth/refresh` });
}

// export async function registerHandler(
//   req: Request,
//   res: Response
// ): Promise<void> {
//   try {
//     const { name, email, password, phone } = req.body;

//     if (!name || !email || !password || !phone) {
//       res.status(400).json({ message: "name, email, password, phone are all required" });
//       return;
//     }

//     const result = await authService.register({ name, email, password, phone });
//     setAuthCookies(res, result.accessToken, result.refreshToken);
//     res.status(201).json({ user: result.user });
//   } catch (err) {
//     handleAuthError(err, res);
//   }
// }

export async function registerInitiateHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      res.status(400).json({ message: "name, email, password, phone are all required" });
      return;
    }

    await authService.initiateRegistration({ name, email, password, phone });
    res.status(200).json({ message: "Verification code sent to your email" });
  } catch (err) {
    handleAuthError(err, res);
  }
}

export async function registerVerifyOtpHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ message: "email and otp are required" });
      return;
    }

    const result = await authService.completeRegistration({ email, otp });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json({ user: result.user });
  } catch (err) {
    handleAuthError(err, res);
  }
}

export async function loginHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "email and password are required" });
      return;
    }

    const result = await authService.login({ email, password });
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  } catch (err) {
    handleAuthError(err, res);
  }
}

export async function refreshHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawRefreshToken) {
      res.status(401).json({ message: "No refresh token provided" });
      return;
    }

    const result = await authService.refresh(rawRefreshToken);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(200).json({ user: result.user });
  } catch (err) {
    // If refresh fails for any reason, clear whatever cookies the
    // browser has — they're no good anymore, don't let it keep sending them.
    clearAuthCookies(res);
    handleAuthError(err, res);
  }
}

export async function logoutHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (rawRefreshToken) {
      await authService.logout(rawRefreshToken);
    }
    clearAuthCookies(res);
    res.status(200).json({ message: "Logged out" });
  } catch (err) {
    handleAuthError(err, res);
  }
}

/**
 * Central place to turn a caught error into an HTTP response. AuthError
 * carries its own statusCode (400/401/409...); anything else is treated
 * as an unexpected server error (500) — and we deliberately DON'T leak
 * its raw message to the client, only log it server-side.
 */
function handleAuthError(err: unknown, res: Response): void {
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }
  console.error("Unexpected auth error:", err);
  res.status(500).json({ message: "Something went wrong" });
}