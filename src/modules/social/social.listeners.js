import logger from '../../core/logger/logger.js';
import Database from '../../core/config/db.js';
import eventBus from '../../core/events/eventBus.js';
import { EventTypes } from '../../core/events/eventTypes.js';

/**
 * Profile Module Event Listeners
 * Phase 3A: Implement profile updates via events (DUAL MODE)
 * 
 * Profile module listens to battle and submission events to update user stats
 * Keeps existing RankingService calls for now (dual mode)
 */

/**
 * Handle SubmissionCompleted event - Update practice stats
 * Triggered when a submission completes
 * 
 * Optional: Track practice submissions for stats
 */
export async function handleSubmissionCompleted(payload) {
    const { userId, status, type, context } = payload;
    
    if (!userId) {
        logger.warn('[Profile Listener] ⚠️ SubmissionCompleted event missing userId');
        return;
    }

    try {
        logger.info('[Profile Listener] 📥 SubmissionCompleted event received', {
            userId,
            status,
            type,
            battleId: context?.battleId
        });

        // Only track solo practice submissions (not in battle)
        if (!context?.battleId && type === 'SUBMIT' && status === 'PASSED') {
            // Optional: Update practice stats
            logger.info('[Profile Listener] ✅ Practice submission tracked', {
                userId,
                status
            });
        }
    } catch (error) {
        logger.error('[Profile Listener] ❌ Error handling SubmissionCompleted event:', error);
    }
}

/**
 * Handle UserAuthenticated event - Track login stats
 * Triggered when user logs in
 * 
 * Optional: Track login streaks, last login time
 */
export async function handleUserAuthenticated(payload) {
    const { userId } = payload;
    
    if (!userId) {
        logger.warn('[Profile Listener] ⚠️ UserAuthenticated event missing userId');
        return;
    }

    try {
        logger.info('[Profile Listener] 📥 UserAuthenticated event received', {
            userId
        });

        // NOTE: lastLogin is updated by RewardService.processDailyLogin to avoid
        // a duplicate write. We only log here for observability.
        logger.info('[Profile Listener] ✅ User login tracked', { userId });
    } catch (error) {
        logger.error('[Profile Listener] ❌ Error handling UserAuthenticated event:', error);
    }
}
