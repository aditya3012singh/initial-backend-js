import env from "./core/config/env.js";
import App from "./app.js";
import http from "http";
import logger from "./core/logger/logger.js";
import Database from "./core/config/db.js";
import SocketServer from "./integrations/socket/socket.server.js";
import SocketEmitter from "./core/config/socket.js";
import Redis from "ioredis";
import UserCache from "./core/cache/userCache.js";


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

    // 1. Verify Database Connection (non-blocking, with 3 retries)
    logger.info('[Database] Checking connection to postgres database...');
    const maxRetries = 3;
    const retryDelay = 2000;
    let connected = false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await Database.client.$connect();
        logger.info('✅ [Database] Connection verified.');
        connected = true;
        break;
      } catch (dbError) {
        logger.warn(`⚠️ [Database] Connection attempt ${attempt}/${maxRetries} failed: ${dbError.message}`);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    if (!connected) {
      logger.error('❌ [Database] All connection attempts failed.');
      logger.warn('⚠️ [Database] Continuing boot without active database connection.');
    }

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
      logger.info(`🚀 API Server successfully started on port ${PORT}`);
    });
  }

  static async warmUpCaches() {
    try {
      logger.info("🔥 Warming up Redis caches...");
      const t0 = Date.now();

      // 1. Users — paginated, non-blocking errors
      await UserCache.warmUp();

      logger.info(`✅ All caches warmed up in ${Date.now() - t0}ms`);
    } catch (error) {
      logger.error("❌ Cache warm-up failed:", error);
      logger.warn("⚠️  Continuing without cache warm-up");
    }
  }
}

export default ServerApp;
