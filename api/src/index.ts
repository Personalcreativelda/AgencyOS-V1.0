import 'dotenv/config';
import app from './app';
import { startScheduledPublisher } from './jobs/scheduledPublisher';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🚀 AgencyOS API`);
  console.log(`   Running at: http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: ${process.env.DATABASE_URL}`);
  console.log(`\n📡 API base: http://localhost:${PORT}/api/v1\n`);

  startScheduledPublisher();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
