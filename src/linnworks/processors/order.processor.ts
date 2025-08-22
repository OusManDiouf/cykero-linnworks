import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('order-processing')
export class OrderProcessor {}

@Processor('order-polling')
export class PollingProcessor extends WorkerHost {
  process(job: Job, token?: string): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
