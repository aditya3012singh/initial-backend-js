import { Kafka } from 'kafkajs';
import logger from '../../logger/logger.js';

export class KafkaEventBus {
    constructor() {
        this.kafka = undefined;
        this.producer = undefined;
        this.consumer = undefined;
        this.clientId = 'base-backend';
        this.topicName = 'app_events';
        this.brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
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

        await this.consumer.subscribe({ topic: this.topicName, fromBeginning: false });

        await this.consumer.run({
            eachMessage: async ({ message }) => {
                try {
                    const key = message.key?.toString();
                    if (key === eventName && message.value) {
                        const content = JSON.parse(message.value.toString());
                        await handler(content.payload);
                    }
                } catch (error) {
                    logger.error(`[Kafka] Error handling event ${eventName}:`, error);
                }
            }
        });
    }

    async shutdown() {
        await this.producer?.disconnect();
        await this.consumer?.disconnect();
        logger.info('🔌 [Kafka] Disconnected from Kafka.');
    }
}
