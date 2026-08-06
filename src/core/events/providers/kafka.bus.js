import { Kafka } from 'kafkajs';
import logger from '../../logger/structuredLogger.js';

export class KafkaEventBus {
    constructor() {
        this.kafka = undefined;
        this.producer = undefined;
        this.consumer = undefined;
        this.clientId = 'base-backend';
        this.topicName = 'app_events';
        this.brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
        this.handlers = new Map();
        this.isConsuming = false;
    }

    async initialize() {
        try {
            logger.info('🔌 [Kafka] Connecting to Kafka brokers...');
            this.kafka = new Kafka({
                clientId: this.clientId,
                brokers: this.brokers
            });

            this.producer = this.kafka.producer();
            await this.producer.connect();

            this.consumer = this.kafka.consumer({ groupId: 'base-backend-group' });
            await this.consumer.connect();

            logger.info('✅ [Kafka] Connected successfully.');
        } catch (error) {
            logger.error('❌ [Kafka] Failed to connect/initialize Kafka:', error);
            throw error;
        }
    }

    async emitEvent(eventName, payload, eventId) {
        if (!this.producer) {
            throw new Error('[Kafka] Event bus producer is not initialized.');
        }

        await this.producer.send({
            topic: this.topicName,
            messages: [
                {
                    key: eventName,
                    value: JSON.stringify({
                        eventId,
                        eventName,
                        payload,
                        timestamp: new Date().toISOString()
                    })
                }
            ]
        });
    }

    async onEvent(eventName, handler) {
        if (!this.consumer) {
            throw new Error('[Kafka] Event bus consumer is not initialized.');
        }

        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);
        }
        this.handlers.get(eventName).push(handler);

        await this.consumer.subscribe({ topic: this.topicName, fromBeginning: false });

        if (!this.isConsuming) {
            this.isConsuming = true;
            setTimeout(() => this.startConsumeLoop(), 100);
        }
    }

    async startConsumeLoop() {
        if (!this.consumer) return;

        try {
            logger.info('📊 [Kafka] Starting single consumer message loop...');
            await this.consumer.run({
                eachMessage: async ({ message }) => {
                    try {
                        const key = message.key?.toString();
                        if (key && message.value) {
                            const content = JSON.parse(message.value.toString());
                            const handlers = this.handlers.get(key) || [];
                            
                            logger.info(`[Kafka] 📥 Received event: ${key} (dispatching to ${handlers.length} handlers)`);
                            
                            for (const handler of handlers) {
                                try {
                                    await handler(content.payload);
                                } catch (hErr) {
                                    logger.error(`[Kafka] ❌ Handler error for event ${key}:`, hErr);
                                }
                            }
                        }
                    } catch (err) {
                        logger.error('[Kafka] Error processing message:', err);
                    }
                }
            });
        } catch (error) {
            logger.error('[Kafka] Failed to start consumer message loop:', error);
            this.isConsuming = false;
        }
    }

    async shutdown() {
        await this.producer?.disconnect();
        await this.consumer?.disconnect();
        logger.info('🔌 [Kafka] Disconnected from Kafka.');
    }
}
