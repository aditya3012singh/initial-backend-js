import userRepository from "./repositories/user.repository.js";
import bcrypt from "bcrypt";
import JwtService from "../../utils/jwt.js";
import crypto from "crypto";
import env from "../../core/config/env.js";
import EmailService from "../../core/email/email.service.js";

const MAX_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

class AuthService {
  static async loginService(email, password) {

    const user = await userRepository.findByEmail(email);
    if (!user) {
      const err = new Error("Invalid credentials");
      err.statusCode = 401;
      throw err;
    }

    // account locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      const err = new Error("Account locked. Try later.");
      err.statusCode = 403;
      throw err;
    }

    if (!user.password) {
      const err = new Error("This account was created via Google/GitHub. Please log in using Google or GitHub.");
      err.statusCode = 400;
      throw err;
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      const attempts = user.failedLoginCount + 1;
      await userRepository.update(user.id, {
        failedLoginCount: attempts,
        lockUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_TIME) : null,
      });
      const err = new Error("Invalid credentials");
      err.statusCode = 401;
      throw err;
    }

    // reset failures
    await userRepository.update(user.id, { failedLoginCount: 0, lockUntil: null });

    const accessToken = JwtService.generateAccessToken({
      id: user.id,
      role: user.role,
    });

    const refreshToken = JwtService.generateRefreshToken({ id: user.id });

    // token rotation (store hash)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await userRepository.update(user.id, { refreshTokenHash });

    return { accessToken, refreshToken, user };
  }

  static async registerService(email, username, password) {
    try {
      const existing = await userRepository.findByEmailOrUsername(email, username);
      if (existing) {
        const isEmail = existing.email === email;
        const err = new Error(isEmail ? "Email already in use" : "Username already in use");
        err.status = 409;
        throw err;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await userRepository.create({
        email,
        username,
        password: hashedPassword,
        role: "USER",
      });

      // Issuing tokens for auto-login
      const accessToken = JwtService.generateAccessToken({
        id: user.id,
        role: user.role,
      });

      const refreshToken = JwtService.generateRefreshToken({ id: user.id });
      const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
      await userRepository.update(user.id, { refreshTokenHash });

      return {
        message: "Registration successful",
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async refreshTokenService(req, res) {
    const token = req.cookies.refreshToken;
    if (!token) return res.sendStatus(401);

    let payload;
    try {
      payload = JwtService.verifyRefreshToken(token);
    } catch {
      return res.sendStatus(401);
    }

    const user = await userRepository.findById(payload.id);

    if (!user || !user.refreshTokenHash) {
      return res.sendStatus(403);
    }

    // REUSE DETECTION
    const tokenMatches = await bcrypt.compare(token, user.refreshTokenHash);

    if (!tokenMatches) {
      // Token reuse detected
      await userRepository.update(user.id, {
        refreshTokenHash: null,
        tokenVersion: (user.tokenVersion ?? 0) + 1,
      });

      return res.status(403).json({
        message: "Refresh token reuse detected. Session revoked.",
      });
    }

    // Rotate tokens
    const newAccessToken = JwtService.generateAccessToken({
      id: user.id,
      role: user.role,
    });

    const newRefreshToken = JwtService.generateRefreshToken({
      id: user.id,
      tokenVersion: user.tokenVersion,
    });

    const newHash = await bcrypt.hash(newRefreshToken, 10);
    await userRepository.update(user.id, { refreshTokenHash: newHash });

    const { default: CookieOptions } = await import("../../utils/cookies.js");

    res
      .cookie("accessToken", newAccessToken, CookieOptions.accessCookieOptions)
      .cookie("refreshToken", newRefreshToken, CookieOptions.refreshCookieOptions)
      .json({ message: "Token refreshed", accessToken: newAccessToken });
  }

  static async forgotPasswordService(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      return { message: "If an account with that email exists, a reset link has been sent." };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

    await userRepository.updateByEmail(email, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: tokenExpiry,
    });

    const baseUrl = env.FRONTEND_URL.endsWith('/') ? env.FRONTEND_URL.slice(0, -1) : env.FRONTEND_URL;
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    await EmailService.sendEmail({
      to: email,
      subject: 'Reset your password',
      text: `Click this link to reset your password: ${resetUrl}`,
      html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password.</p>`
    });

    const result = {
      message: "If an account with that email exists, a reset link has been sent."
    };

    if (env.NODE_ENV !== 'production') {
      result.devTokenHint = resetToken;
    }

    return result;
  }

  static async resetPasswordService(token, newPassword) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await userRepository.findByResetToken(hashedToken);

    if (!user) {
      const err = new Error("Token is invalid or has expired.");
      err.statusCode = 400;
      throw err;
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user.id, {
      password: newHashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    });

    return { message: "Password has been successfully reset." };
  }
}

export default AuthService;
