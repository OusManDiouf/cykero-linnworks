import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { OrderQueueService } from '../services/order-queue.service';
import { OrderRepositoryService } from '../services/order-repository.service';
import {
  ProcessOrderJobData,
  RetryOrderJobData,
} from '../interfaces/queue-jobs.interface';
import { Job } from 'bullmq';

@Processor('order-processing')
export class OrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderProcessor.name);

  constructor(
    private readonly orderRepository: OrderRepositoryService,
    private readonly queueService: OrderQueueService,
  ) {
    super();
  }

  async process(
    job: Job<ProcessOrderJobData | RetryOrderJobData>,
  ): Promise<void> {
    const { name, data } = job;

    switch (name) {
      case 'process-order':
        return this.processOrder(job as Job<ProcessOrderJobData>);
      case 'retry-order':
        return this.retryOrder(job as Job<RetryOrderJobData>);
      default:
        throw new Error(`Unknown job type: ${name}`);
    }
  }
  private async processOrder(job: Job<ProcessOrderJobData>): Promise<void> {}
  private async retryOrder(job: Job<RetryOrderJobData>): Promise<void> {}
}
