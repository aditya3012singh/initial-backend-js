import UserCache from "./userCache.js";
import ProblemCache from "./problemCache.js";
import logger from "../logger/logger.js";

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
     * Invalidate problem cache
     * @param {string} problemId 
     */
    static async invalidateProblem(problemId) {
        try {
            await ProblemCache.invalidateProblem(problemId);
            logger.info(`[CacheManager] Invalidated problem ${problemId} cache`);
        } catch (error) {
            logger.error(`[CacheManager] Error invalidating problem ${problemId}:`, error);
        }
    }

    /**
     * Update problem in cache
     * @param {object} problem 
     */
    static async updateProblem(problem) {
        try {
            await ProblemCache.updateProblem(problem);
            logger.info(`[CacheManager] Updated problem ${problem.id}`);
        } catch (error) {
            logger.error(`[CacheManager] Error updating problem ${problem.id}:`, error);
        }
    }

    /**
     * Invalidate testcases cache
     * @param {string} problemId 
     */
    static async invalidateTestcases(problemId) {
        // No-op (Testcases are handled directly in database / S3)
    }

    /**
     * Update testcases in cache
     * @param {string} problemId 
     * @param {Array} testcases 
     */
    static async updateTestcases(problemId, testcases) {
        // No-op (Testcases are handled directly in database / S3)
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

    /**
     * Invalidate all caches for a problem
     * @param {string} problemId 
     */
    static async invalidateAllForProblem(problemId) {
        try {
            await ProblemCache.invalidateProblem(problemId);
            logger.info(`[CacheManager] Invalidated all caches for problem ${problemId}`);
        } catch (error) {
            logger.error(`[CacheManager] Error invalidating all for problem ${problemId}:`, error);
        }
    }
}

export default CacheManager;
