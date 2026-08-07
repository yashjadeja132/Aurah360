import mongoose from 'mongoose';
import config from './index.js';
import logger from '../libs/logger.js';

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    if (this.connection) {
      return this.connection;
    }

    mongoose.set('strictQuery', true);

    this.connection = await mongoose.connect(config.mongo.uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    logger.info('MongoDB connected', {
      host: this.connection.connection.host,
      name: this.connection.connection.name,
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', { message: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return this.connection;
  }

  async disconnect() {
    if (!this.connection) return;
    await mongoose.disconnect();
    this.connection = null;
    logger.info('MongoDB disconnected cleanly');
  }
}

export const database = new Database();
export default database;
