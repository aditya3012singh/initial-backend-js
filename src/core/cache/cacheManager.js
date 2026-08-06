import UserCache from "./userCache.js";
import logger from "../logger/structuredLogger.js";

/**
 * Cache Manager
 * Handles cache invalidation and updates across all cache services
 */
class CacheManager {
    /**
     * Invalidate user profile cache
     * @param {string} userId 
     */
    static async invalidateUser(userId) {
        try {
            await UserCache.invalidateUser(userId);
            logger.info(`[CacheManager] Invalidated user ${userId} cache`);
        } catch (error) {
            logger.error(`[CacheManager] Error invalidating user ${userId}:`, error);
        }
    }

    /**
     * Update user profile in cache
     * @param {object} user 
     */
    static async updateUserProfile(user) {
        try {
            await UserCache.updateUserProfile(user);
            logger.info(`[CacheManager] Updated user profile ${user.id}`);
        } catch (error) {
            logger.error(`[CacheManager] Error updating user profile ${user.id}:`, error);
        }
    }

    /**
     * Invalidate all caches for a user
     * @param {string} userId 
     */
    static async invalidateAllForUser(userId) {
        try {
            await UserCache.invalidateUser(userId);
            logger.info(`[CacheManager] Invalidated all caches for user ${userId}`);
        } catch (error) {
            logger.error(`[CacheManager] Error invalidating all for user ${userId}:`, error);
        }
    }
}

export default CacheManager;
