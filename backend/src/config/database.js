import mongoose from 'mongoose';
import { createClient } from 'redis';
import neo4j from 'neo4j-driver';
import { env } from './env.js';

export const redis = createClient({ url: env.redisUrl });
export const neo4jDriver = neo4j.driver(
  env.neo4jUri,
  neo4j.auth.basic(env.neo4jUsername, env.neo4jPassword)
);

redis.on('error', (error) => console.error('[Redis]', error.message));

export async function connectDatabases() {
  await mongoose.connect(env.mongoUri);
  if (!redis.isOpen) await redis.connect();
  await neo4jDriver.verifyConnectivity();
  console.log('Connected to MongoDB, Redis and Neo4j');
}

export async function closeDatabases() {
  await Promise.allSettled([
    mongoose.disconnect(),
    redis.isOpen ? redis.quit() : Promise.resolve(),
    neo4jDriver.close()
  ]);
}

