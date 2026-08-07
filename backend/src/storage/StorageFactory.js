import config from '../config/index.js';
import LocalStorage from './LocalStorage.js';
import {
  S3StoragePlaceholder,
  AzureStoragePlaceholder,
  GcsStoragePlaceholder,
} from './CloudStoragePlaceholder.js';
import ApiError from '../libs/ApiError.js';

class StorageFactory {
  static create() {
    switch (config.storage.driver) {
      case 'local':
        return new LocalStorage();
      case 's3':
        return new S3StoragePlaceholder();
      case 'azure':
        return new AzureStoragePlaceholder();
      case 'gcs':
        return new GcsStoragePlaceholder();
      default:
        throw ApiError.internal(`Unknown storage driver: ${config.storage.driver}`);
    }
  }
}

export default StorageFactory;
