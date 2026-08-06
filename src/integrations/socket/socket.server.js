import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import RedisClient from "../../core/cache/redis.client.js";
import jwt from "jsonwebtoken";
import env from "../../core/config/env.js";
import logger from "../../core/logger/structuredLogger.js";
import UserCache from "../../core/cache/userCache.js";


class SocketServer {
    static io = null;

    static initialize(server) {
        const allowedOrigins = [
            env.FRONTEND_URL,
            ...env.ALLOWED_ORIGINS
        ].filter(Boolean);

        this.io = new Server(server, {
            cors: {
                origin: (origin, callback) => {
                    const normalizedOrigin = origin ? origin.toLowerCase().trim() : null;
                    const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase().trim());

                    // 1. Development bypass
                    if (process.env.NODE_ENV === 'development' && (!origin || origin.startsWith('http://localhost:'))) {
                        return callback(null, true);
                    }

                    // 2. Exact match or no origin
                    if (!origin || normalizedAllowed.includes(normalizedOrigin)) {
                        logger.info(`🔌 [SocketCORS] ACCEPTED: ${origin}`);
                        return callback(null, true);
                    }

                    // 3. Pattern match for Netlify/Vercel (very common for rejections)
                    if (normalizedOrigin.includes('netlify.app') || normalizedOrigin.includes('vercel.app')) {
                        logger.info(`🔌 [SocketCORS] PATTERN ACCEPTED: ${origin}`);
                        return callback(null, true);
                    }

                    logger.warn(`🛑 [SocketCORS] REJECTED: "${origin}" (Allowed: ${normalizedAllowed.join(", ")})`);
                    callback(new Error(`Origin ${origin} not allowed by CORS`));
                },
                methods: ["GET", "POST"],
                credentials: true
            },
        });

        if (env.REDIS_URL || env.REDIS_HOST) {
            try {
                const redisConfig = {
                    host: env.REDIS_HOST,
                    port: env.REDIS_PORT,
                    password: env.REDIS_PASSWORD,
                    maxRetriesPerRequest: null,
                };

                const pubClient = env.REDIS_URL
                    ? new Redis(env.REDIS_URL, { ...redisConfig, maxRetriesPerRequest: null })
                    : new Redis(redisConfig);

                const subClient = pubClient.duplicate();

                pubClient.on('error', (err) => logger.error(`Redis PubClient Error: ${err.message}`));
                subClient.on('error', (err) => logger.error(`Redis SubClient Error: ${err.message}`));

                this.io.adapter(createAdapter(pubClient, subClient));
                logger.info("🔌 Socket.IO Redis Adapter configured successfully");
            } catch (err) {
                logger.warn(`⚠️ Failed to configure Socket.IO Redis Adapter: ${err.message}. Falling back to in-memory adapter.`);
            }
        } else {
            logger.warn("⚠️ Redis configuration not found. Socket.IO falling back to in-memory adapter.");
        }

        this.setupMiddleware();
        this.setupEventHandlers();

        return this.io;
    }



    static setupMiddleware() {
        this.io.use((socket, next) => {
            const token = socket.handshake.auth?.token;

            if (!token) {
                logger.info(`ℹ️ [SocketAuth] Guest connection allowed (${socket.id})`);
                socket.userId = null;
                socket.isGuest = true;
                return next();
            }

            try {
                const decoded = jwt.verify(token.trim(), env.JWT_ACCESS_SECRET);
                socket.user = decoded;
                socket.userId = decoded.id;
                socket.isGuest = false;
                logger.info(`🔐 [SocketAuth] SUCCESS: ${decoded.id} (${socket.id})`);
                next();
            } catch (err) {
                logger.warn(`🛑 [SocketAuth] INVALID TOKEN (Proceeding as Guest): ${err.message} (${socket.id})`);
                socket.userId = null;
                socket.isGuest = true;
                next(); // Still allow connection, but as a guest
            }
        });
    }

    static setupEventHandlers() {
        this.io.on("connection", (socket) => {
            logger.info(`🟢 User connected: ${socket.id} (User: ${socket.userId})`);

            // Always join a private room for user-specific events (e.g., practice results)
            const userRoom = `user_${socket.userId}`;
            socket.join(userRoom);
            const sockets = this.io.sockets.adapter.rooms.get(userRoom);
            const count = sockets ? (sockets.size || sockets.length) : 0;
            logger.info(`🏠 User ${socket.userId} joined private room: ${userRoom} (Total in room: ${count})`);



            // 3. Presence Tracking (Online Status)
            this.updatePresence(socket.userId, true);

            // 4. Heartbeat Handler (keeps presence updated)
            socket.on("heartbeat", () => {
                this.updateHeartbeat(socket.userId);
            });

            // 5. Disconnect
            socket.on("disconnect", () => {
                this.updatePresence(socket.userId, false);
                logger.info(`🔴 User disconnected: ${socket.id}`);
            });
        });
    }

    static async updatePresence(userId, isOnline) {
        if (!userId) return;
        try {
            if (isOnline) {
                await UserCache.markOnline(userId);
                // Also cache user data if available
                if (this.io && this.io.sockets && this.io.sockets.sockets) {
                    const socket = Array.from(this.io.sockets.sockets.values()).find(s => s.userId === userId);
                    if (socket && socket.user) {
                        await UserCache.cacheUser(socket.user, true);
                    }
                }
            } else {
                await UserCache.markOffline(userId);
            }
            // Broadcast presence change to everyone (or just friends - for now everyone is simpler)
            this.io.emit("user_presence_update", { userId, isOnline });
        } catch (err) {
            logger.error(`Error updating presence for ${userId}: ${err.message}`);
        }
    }

    /**
     * Update user presence (heartbeat) - called every 10 seconds
     * @param {string} userId 
     */
    static async updateHeartbeat(userId) {
        if (!userId) return;
        try {
            await UserCache.updatePresence(userId);
        } catch (err) {
            logger.error(`Error updating heartbeat for ${userId}: ${err.message}`);
        }
    }
}

export default SocketServer;
