import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { LinnworksApiService } from '../services/linnworks-api.service';
import { OrderQueueService } from '../services/order-queue.service';
import { Job } from 'bullmq';
import { PollOrdersJobData } from '../interfaces/queue-jobs.interface';

@Processor('order-polling')
export class PollingProcessor extends WorkerHost {
  private readonly logger = new Logger(PollingProcessor.name);

  constructor(
    private readonly linnworksApi: LinnworksApiService,
    private readonly queueService: OrderQueueService,
  ) {
    super();
  }

  async process(job: Job<PollOrdersJobData>): Promise<void> {
    const { fromDate, batchSize, forced } = job.data;

    try {
      this.logger.debug(`Polling for orders since ${fromDate.toISOString()}`);
      return Promise.resolve();
    } catch (error) {
      this.logger.error('Polling job failed:', error);
      throw error;
    }
  }
}
