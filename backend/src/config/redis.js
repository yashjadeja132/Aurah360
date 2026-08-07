import Redis from 'ioredis';
import config from './index.js';
import logger from '../libs/logger.js';

class RedisClient {
  constructor() {
    this.client = null;
  }

  connect() {
    if (this.client) {
      return this.client;
    }

    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      logger.info('Redis connecting…');
    });

    this.client.on('ready', () => {
      logger.info('Redis ready');
    });

    this.client.on('error', (err) => {
      logger.error('Redis error', { message: err.message });
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return this.client;
  }

  async ready() {
    const client = this.connect();
    if (client.status === 'wait' || client.status === 'end') {
      await client.connect();
    }
    return client;
  }

  getClient() {
    return this.connect();
  }

  async disconnect() {
    if (!this.client) return;
    await this.client.quit();
    this.client = null;
    logger.info('Redis disconnected cleanly');
  }
}

export const redisClient = new RedisClient();
export default redisClient;
