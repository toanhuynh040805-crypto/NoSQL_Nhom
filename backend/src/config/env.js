import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_nosql',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  neo4jUri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4jUsername: process.env.NEO4J_USERNAME || 'neo4j',
  neo4jPassword: process.env.NEO4J_PASSWORD || 'restaurant123',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};

