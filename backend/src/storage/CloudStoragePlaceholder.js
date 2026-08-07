import ApiError from '../libs/ApiError.js';

/**
 * Future cloud storage adapters (S3 / Azure Blob / GCS).
 * LocalStorage remains the production default until credentials are configured.
 */
class CloudStoragePlaceholder {
  constructor(provider) {
    this.provider = provider;
  }

  #notReady() {
    throw ApiError.internal(
      `${this.provider} storage adapter is not implemented yet. Set STORAGE_DRIVER=local or implement the adapter.`
    );
  }

  async save() {
    this.#notReady();
  }

  async delete() {
    this.#notReady();
  }

  async getSignedUrl() {
    this.#notReady();
  }

  async getAbsolutePath() {
    this.#notReady();
  }
}

export class S3StoragePlaceholder extends CloudStoragePlaceholder {
  constructor() {
    super('S3');
  }
}

export class AzureStoragePlaceholder extends CloudStoragePlaceholder {
  constructor() {
    super('Azure Blob');
  }
}

export class GcsStoragePlaceholder extends CloudStoragePlaceholder {
  constructor() {
    super('GCS');
  }
}

export default CloudStoragePlaceholder;
