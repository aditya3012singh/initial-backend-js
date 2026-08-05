// • Register user
// • Login user
// • Issue JWT

import AuthService from "./auth.service.js";
import userRepository from "./repositories/user.repository.js";
import CookieOptions from "../../utils/cookies.js";
import AuthSchema from "./auth.schema.js";
import S3Service from "../../integrations/s3/s3.service.js";
import JwtService from "../../utils/jwt.js";
import env from "../../core/config/env.js";
import passport from "passport";
import eventBus from "../../core/events/eventBus.js";
import { EventTypes } from "../../core/events/eventTypes.js";
import RedisClient from "../../core/cache/redis.client.js";
import bcrypt from "bcrypt";

class AuthController {
    static async login(req, res) {
        const { email, password } = req.validated.body;

        const { accessToken, refreshToken, user } = await AuthService.loginService(email, password);

        res
            .cookie("accessToken", accessToken, CookieOptions.accessCookieOptions)
            .cookie("refreshToken", refreshToken, CookieOptions.refreshCookieOptions)
            .ok({
                accessToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            }, "Login successful");

        // Emit event
        eventBus.emitEvent(EventTypes.USER_AUTHENTICATED, {
            userId: user.id,
            timestamp: new Date(),
            method: 'password'
        });
    }

    static async Register(req, res) {
        const { email, username, password } = req.validated.body;

        const { accessToken, refreshToken, user, message } = await AuthService.registerService(email, username, password);

        res
            .cookie("accessToken", accessToken, CookieOptions.accessCookieOptions)
            .cookie("refreshToken", refreshToken, CookieOptions.refreshCookieOptions)
            .created({
                accessToken,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            }, message);
    }

    static async logout(req, res) {
        const userId = req.user?.id;

        if (userId) {
            await userRepository.update(userId, { refreshTokenHash: null });
        }

        // Clear cookies
        res
            .clearCookie("accessToken", CookieOptions.accessCookieOptions)
            .clearCookie("refreshToken", CookieOptions.refreshCookieOptions)
            .ok({}, "Logout successful");
    }

    static async getProfile(req, res) {
        const userId = req.user.id;
        const cacheKey = `user:full_profile:${userId}`;

        try {
            const cached = await RedisClient.client.get(cacheKey);
            if (cached) {
                return res.status(200).json(JSON.parse(cached));
            }
        } catch (err) {
            // Cache hit failure is handled silently
        }

        const user = await userRepository.findById(userId);

        if (!user) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }

        const { password, ...userWithoutPassword } = user.toObject ? user.toObject() : user;
        const responseData = {
            user: {
                ...userWithoutPassword,
                hasPassword: !!password
            }
        };

        const resultBody = {
            success: true,
            message: "Profile fetched successfully",
            data: responseData
        };

        try {
            await RedisClient.client.set(cacheKey, JSON.stringify(resultBody), "EX", 3600); // 1 Hour TTL
        } catch (err) {
            // Cache write failure is handled silently
        }

        res.ok(responseData, "Profile fetched successfully");
    }

    static async refreshToken(req, res) {
        await AuthService.refreshTokenService(req, res);
    }

    static async getPublicProfile(req, res) {
        const { username } = req.params;

        const user = await userRepository.findByUsername(username);

        if (!user) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }

        res.ok({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                profilePic: user.profilePic,
                linkedin: user.linkedin,
                github: user.github
            }
        }, "Public profile fetched successfully");
    }

    static async updateProfile(req, res) {
        const userId = req.user.id;
        const updateData = req.body;

        // Fields allowed to be updated
        const allowedFields = ['profilePic', 'linkedin', 'github'];
        const dataToUpdate = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                dataToUpdate[field] = updateData[field];
            }
        }

        const updatedUser = await userRepository.update(userId, dataToUpdate);

        await RedisClient.client.del(`user:full_profile:${userId}`).catch(() => {});

        res.ok({
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                profilePic: updatedUser.profilePic,
                linkedin: updatedUser.linkedin,
                github: updatedUser.github
            }
        }, "Profile updated successfully");
    }

    static async getProfileUploadUrl(req, res) {
        const userId = req.user.id;
        const { fileName, fileType } = req.query;

        if (!fileName || !fileType) {
            const err = new Error("fileName and fileType are required");
            err.statusCode = 400;
            throw err;
        }

        const extension = fileName.split('.').pop();
        const key = `avatars/${userId}_${Date.now()}.${extension}`;

        const { uploadUrl, fileUrl } = await S3Service.getPresignedUrl(key, fileType);

        res.ok({ uploadUrl, fileUrl }, "Upload URL generated successfully");
    }

    static async forgotPassword(req, res) {
        const { email } = req.validated.body;
        const result = await AuthService.forgotPasswordService(email);
        res.ok(result, "Reset instructions processed");
    }

    static async resetPassword(req, res) {
        const token = req.params.token || req.body.token;
        const newPassword = req.body.newPassword;

        const validationResult = AuthSchema.resetPasswordSchema.safeParse({ token, newPassword });
        if (!validationResult.success) {
            const err = new Error(validationResult.error.errors[0].message);
            err.statusCode = 400;
            throw err;
        }

        const result = await AuthService.resetPasswordService(token, newPassword);
        res.ok(result, "Password reset successfully");
    }

    static async socialAuthCallback(req, res) {
        try {
            const user = req.user;
            if (!user) return res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);

            const accessToken = JwtService.generateAccessToken({
                id: user.id,
                role: user.role,
            });

            const refreshToken = JwtService.generateRefreshToken({ id: user.id });
            const hashedToken = await bcrypt.hash(refreshToken, 10);

            await userRepository.update(user.id, { refreshTokenHash: hashedToken });

            const { state } = req.query;
            let redirectTo = "/";
            if (state) {
                try {
                    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
                    if (decoded.redirectTo) redirectTo = decoded.redirectTo;
                } catch (e) {
                    console.error("Failed to parse social auth state:", e);
                }
            }

            const baseUrl = env.FRONTEND_URL.endsWith('/') ? env.FRONTEND_URL.slice(0, -1) : env.FRONTEND_URL;
            const targetPath = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
            const finalUrl = `${baseUrl}${targetPath}${targetPath.includes('?') ? '&' : '?'}accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&auth_success=true`;

            res
                .cookie("accessToken", accessToken, CookieOptions.accessCookieOptions)
                .cookie("refreshToken", refreshToken, CookieOptions.refreshCookieOptions)
                .redirect(finalUrl);

            // Emit event
            eventBus.emitEvent(EventTypes.USER_AUTHENTICATED, {
                userId: user.id,
                timestamp: new Date(),
                method: user.googleId ? 'google' : 'github'
            });
        } catch (error) {
            console.error("Social auth callback error:", error);
            res.redirect(`${env.FRONTEND_URL}/login?error=server_error`);
        }
    }

    static async changePassword(req, res) {
        const { oldPassword, newPassword } = req.validated.body;
        const userId = req.user.id;

        const user = await userRepository.findById(userId);
        if (!user) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }

        if (!user.password) {
            const err = new Error("OAuth accounts must use their provider to log in or reset password via email to set one.");
            err.statusCode = 400;
            throw err;
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            const err = new Error("Invalid old password");
            err.statusCode = 400;
            throw err;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await userRepository.update(userId, { password: hashedPassword });

        res.ok({}, "Password updated successfully");
    }
}

export default AuthController;
