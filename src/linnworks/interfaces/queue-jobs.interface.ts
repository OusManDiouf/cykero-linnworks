export interface ProcessOrderJobData {
  orderId: string;
  orderData: any;
  source: 'poll' | 'manual' | 'webhook';
  priority?: number;
  retryCount?: number;
}

export interface PollOrdersJobData {
  fromDate: Date;
  batchSize: number;
  forced?: boolean;
}

export interface RetryOrderJobData {
  orderId: string;
  originalJobData: ProcessOrderJobData;
  retryCount: number;
  lastError: string;
}
