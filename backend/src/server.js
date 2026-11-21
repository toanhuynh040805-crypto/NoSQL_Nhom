import app from './app.js';
import { env } from './config/env.js';
import { closeDatabases, connectDatabases } from './config/database.js';
import { ensureGraphConstraints } from './services/graph.js';

async function start() {
  await connectDatabases();
  await ensureGraphConstraints();
  const server = app.listen(env.port, () => {
    console.log(`API listening at http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeDatabases();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(error => {
  console.error('Cannot start application:', error);
  process.exit(1);
});

