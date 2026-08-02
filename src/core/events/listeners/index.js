import eventBus from '../eventBus.js';
import { EventTypes } from '../eventTypes.js';
import logger from '../../logger/logger.js';

// Import module listeners
import * as RewardListeners from '../../../modules/reward/reward.listeners.js';
import * as NotificationListeners from '../../../modules/notification/notification.listeners.js';

/**
 * Register all event listeners
 * Call this once during application startup
 */
export function registerAllListeners() {
    logger.info('[EventBus] 🚀 Registering all event listeners...');

    try {
        // Reward Module Listeners
        eventBus.onEvent(EventTypes.USER_AUTHENTICATED, RewardListeners.handleUserAuthenticated);

        // Notification Module Listeners
        eventBus.onEvent(EventTypes.REWARD_GRANTED, NotificationListeners.handleRewardGranted);
        eventBus.onEvent(EventTypes.ACHIEVEMENT_UNLOCKED, NotificationListeners.handleAchievementUnlocked);
        eventBus.onEvent('FriendRequestSent', NotificationListeners.handleFriendRequestSent);
        eventBus.onEvent('FriendRequestAccepted', NotificationListeners.handleFriendRequestAccepted);

        logger.info('[EventBus] ✅ All event listeners registered successfully');
        logger.info('[EventBus] 📊 Total listeners registered:', eventBus.listenerCount());
    } catch (error) {
        logger.error('[EventBus] ❌ Failed to register event listeners:', error);
        throw error;
    }
}
