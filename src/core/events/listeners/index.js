import eventBus from '../eventBus.js';
import { EventTypes } from '../eventTypes.js';
import logger from '../../logger/structuredLogger.js';

/**
 * Register all event listeners
 * Call this once during application startup
 */
export function registerAllListeners() {
    logger.info('[EventBus] 🚀 Registering all event listeners...');

    try {
        // Core/Generic event listeners can be registered here
        
        logger.info('[EventBus] ✅ All event listeners registered successfully');
        logger.info('[EventBus] 📊 Total listeners registered:', eventBus.listenerCount());
    } catch (error) {
        logger.error('[EventBus] ❌ Failed to register event listeners:', error);
        throw error;
    }
}
