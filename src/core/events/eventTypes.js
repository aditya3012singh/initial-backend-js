/**
 * Central registry of all domain events
 * This serves as documentation and prevents typos
 */

export const EventTypes = {
    // Auth Module Events
    USER_AUTHENTICATED: 'UserAuthenticated',
    USER_REGISTERED: 'UserRegistered'
};

/**
 * Event payload schemas (for documentation)
 */
export const EventSchemas = {
    [EventTypes.USER_AUTHENTICATED]: {
        userId: 'string',
        timestamp: 'Date',
        method: "'password' | 'google' | 'github'"
    },
    [EventTypes.USER_REGISTERED]: {
        userId: 'string',
        timestamp: 'Date'
    }
};
