import env from "./core/config/env.js";
import App from "./app.js";
import http from "http";
import logger from "./core/logger/logger.js";
import SocketServer from "./integrations/socket/socket.server.js";
import SocketEmitter from "./core/config/socket.js";
import Redis from "ioredis";
import UserCache from "./core/cache/userCache.js";
import ProblemCache from "./core/cache/problemCache.js";


class ServerApp {
  static io = null;
  static subscriber = null;

  static createServer(app) {
    return http.createServer(app);
  }

  static setupRedisSubscriber(io) {
    const redisUrl = env.REDIS_URL ? env.REDIS_URL.trim() : null;
    const redisConnectOptions = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: null,
    };

    if (redisUrl || env.REDIS_HOST) {
      // 🛡️ Assign to static property to prevent GC
      this.subscriber = redisUrl
        ? new Redis(redisUrl, { ...redisConnectOptions, maxRetriesPerRequest: null })
        : new Redis(redisConnectOptions);

      this.subscriber.on("connect", () => {
        logger.info("📡 [RedisSub] Subscriber connected successfully");
      });

      this.subscriber.on("error", (err) => {
        logger.error(`📡 [RedisSub] Connection error: ${err.message}`);
      });

      this.subscriber.subscribe("worker_events", (err, count) => {
        if (err) {
          logger.error(`❌ [RedisSub] Failed to subscribe: ${err.message}`);
        } else {
          logger.info(`✅ [RedisSub] Subscribed to worker_events (${count} channel)`);
        }
      });

      this.subscriber.on("message", (channel, message) => {
        if (channel === "worker_events") {
          try {
            const parsed = JSON.parse(message);
            const { event, data } = parsed;

            logger.info(`📡 [RedisSub] Event: ${event} for User ${data?.userId || data?.user?.id}`);

            if (data && (data.userId || data.user?.id)) {
              const targetId = data.userId || data.user?.id;
              const room = `user_${targetId}`;
              const sockets = io.sockets.adapter.rooms.get(room);
              const count = sockets ? (sockets.size || sockets.length) : 0;
              logger.info(`👤 [Emit] ${event} -> User Room: ${room} (Members: ${count})`);
              io.to(room).emit(event, data);
            }
          } catch (error) {
            logger.error(`❌ [RedisSub] Process error: ${error.message}`);
          }
        }
      });
    }
  }

  static async start() {
    const app = App.createApp();
    const server = this.createServer(app);

    // Initialize Socket Server
    this.io = SocketServer.initialize(server);
    SocketEmitter.setIo(this.io);
    this.setupRedisSubscriber(this.io);

    // Warm up caches on startup
    await this.warmUpCaches();

    const PORT = env.PORT || 4000;
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`❌ Port ${PORT} busy.`);
      } else {
        logger.error(`❌ Server crash: ${err.message}`);
      }
      process.exit(1);
    });

    server.listen(PORT, () => {
      logger.info(`🚀 CodeArena Production Server running on port ${PORT}`);
    });
  }

  /**
   * Warm up all caches on server startup
   */
  static async warmUpCaches() {
    try {
      logger.info("🔥 Warming up Redis caches...");
      const t0 = Date.now();

      // 1. Users — paginated, non-blocking errors
      await UserCache.warmUp();

      // 2. Problems — all problems + difficulty sets
      await ProblemCache.warmUp();

      // 3. Leaderboard ZSET — warm global ranking ZSET
      const { default: LeaderboardService } = await import("./modules/leaderboard/leaderboard.service.js");
      await LeaderboardService.warmUpZSet();

      logger.info(`✅ All caches warmed up in ${Date.now() - t0}ms`);
    } catch (error) {
      logger.error("❌ Cache warm-up failed:", error);
      logger.warn("⚠️  Continuing without cache warm-up");
    }
  }
}

export default ServerApp;
