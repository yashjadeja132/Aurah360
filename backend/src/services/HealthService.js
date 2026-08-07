import os from 'os';
import fs from 'fs';
import mongoose from 'mongoose';
import config from '../config/index.js';
import redisClient from '../config/redis.js';
import { QUEUE_NAMES, getQueue } from '../queues/connection.js';

class HealthService {
  isAlive() {
    return {
      status: 'ok',
      ts: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async checkMongo() {
    const state = mongoose.connection.readyState;
    return {
      status: state === 1 ? 'up' : 'down',
      readyState: state,
    };
  }

  async checkRedis() {
    try {
      const client = redisClient.getClient();
      if (!client || client.status !== 'ready') {
        return { status: 'down' };
      }
      const pong = await client.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch (err) {
      return { status: 'down', message: err.message };
    }
  }

  async checkBullMq() {
    const queues = {};
    let healthy = true;
    for (const name of Object.values(QUEUE_NAMES)) {
      try {
        const q = getQueue(name);
        const [waiting, active, failed, delayed] = await Promise.all([
          q.getWaitingCount(),
          q.getActiveCount(),
          q.getFailedCount(),
          q.getDelayedCount(),
        ]);
        queues[name] = { waiting, active, failed, delayed, status: 'up' };
      } catch (err) {
        healthy = false;
        queues[name] = { status: 'down', message: err.message };
      }
    }
    return { status: healthy ? 'up' : 'degraded', queues };
  }

  processMetrics() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const load = os.loadavg();
    return {
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        systemTotal: totalMem,
        systemFree: freeMem,
        systemUsedPct: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)),
      },
      cpu: {
        cores: os.cpus().length,
        loadAvg1m: load[0],
        loadAvg5m: load[1],
        loadAvg15m: load[2],
      },
      disk: this.#diskUsage(),
      platform: os.platform(),
      node: process.version,
    };
  }

  #diskUsage() {
    try {
      const root = process.cwd();
      const stats = fs.statfsSync ? fs.statfsSync(root) : null;
      if (!stats) return { status: 'unavailable' };
      const total = stats.blocks * stats.bsize;
      const free = stats.bfree * stats.bsize;
      return {
        status: 'ok',
        path: root,
        totalBytes: total,
        freeBytes: free,
        usedPct: Number((((total - free) / total) * 100).toFixed(2)),
      };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async readiness() {
    const [mongo, redis] = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const ready = mongo.status === 'up' && redis.status === 'up';
    return {
      ready,
      status: ready ? 'ready' : 'not_ready',
      checks: { mongodb: mongo, redis },
    };
  }

  async fullHealth() {
    const [mongo, redis, bullmq] = await Promise.all([
      this.checkMongo(),
      this.checkRedis(),
      this.checkBullMq(),
    ]);
    const metrics = this.processMetrics();
    const healthy = mongo.status === 'up';
    const degraded = redis.status !== 'up' || bullmq.status !== 'up';

    return {
      status: !healthy ? 'down' : degraded ? 'degraded' : 'ok',
      app: config.app.name,
      clinic: config.clinic.name,
      env: config.app.env,
      version: 'v1',
      uptime: process.uptime(),
      checks: { mongodb: mongo, redis, bullmq },
      metrics,
    };
  }
}

export default HealthService;
