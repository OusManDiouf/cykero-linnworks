import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/order.schema';
import { Model } from 'mongoose';

@Injectable()
export class OrderRepositoryService {
  private readonly logger = new Logger(OrderRepositoryService.name);

  constructor(@InjectModel(Order.name) private orderModel: Model<Order>) {}
}
