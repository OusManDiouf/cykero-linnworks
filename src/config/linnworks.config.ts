import { registerAs } from '@nestjs/config';

export default registerAs('linnworks', () => ({
  apiUrl: process.env.LINNWORKS_API_URL || 'https://eu-ext.linnworks.net/api',
  // Linnworks requires the global endpoint for authorization
  authApiUrl:
    process.env.LINNWORKS_AUTH_API_URL || 'https://api.linnworks.net/api',
  applicationId: process.env.LINNWORKS_APPLICATION_ID,
  applicationSecret: process.env.LINNWORKS_APPLICATION_SECRET,
  installationToken: process.env.LINNWORKS_INSTALLATION_TOKEN, // Added this
  pollInterval:
    parseInt(process.env.LINNWORKS_POLL_INTERVAL as string) || 30000,
  batchSize: parseInt(process.env.LINNWORKS_BATCH_SIZE as string) || 50,
  maxRetries: parseInt(process.env.LINNWORKS_MAX_RETRIES as string) || 3,
}));
