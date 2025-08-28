import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Order } from '../schemas/order.schema';
import { Model } from 'mongoose';
import { mapLinnworksOrderEnvelopeToOrder } from '../mappers/order.mapper';
import { OrderDto } from '../dto/order.dto';

@Injectable()
export class OrderRepositoryService {
  private readonly logger = new Logger(OrderRepositoryService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<Order>,
  ) {}

  /**
   * Get all saved order IDs (step 2)
   */
  async getSavedOrderIds(): Promise<string[]> {
    const orders = await this.orderModel.find({}).select('_id').lean().exec();
    return orders.map((order) => order._id.toString());
  }

  async findById(id: string): Promise<Order | null> {
    return this.orderModel.findById(id).exec();
  }

  // Find by Zoho Sales Order ID (for incoming shipment webhooks)
  async findByZohoSalesOrderId(
    zohoSalesOrderId: string,
  ): Promise<Order | null> {
    return this.orderModel.findOne({ zohoSalesOrderId }).exec();
  }

  // Persist mapping when we create the remote Zoho sales order
  async setZohoSalesOrderId(
    orderId: string,
    zohoSalesOrderId: string,
  ): Promise<void> {
    await this.orderModel
      .updateOne({ _id: orderId }, { $set: { zohoSalesOrderId } })
      .exec();
  }

  async saveOrders(orders: OrderDto[]): Promise<void> {
    if (orders.length === 0) return;

    const orderDocuments = orders.map((order) =>
      mapLinnworksOrderEnvelopeToOrder(order),
    );

    try {
      // Use bulkWrite with upsert for true idempotency
      const operations = orderDocuments.map((doc) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $setOnInsert: doc }, // Only set if inserting
          upsert: true,
        },
      }));

      const result = await this.orderModel.bulkWrite(operations);

      this.logger.log(
        `✅  Processed ${orderDocuments.length} orders: ${result.upsertedCount} new, ${result.matchedCount} existing`,
      );
    } catch (error) {
      this.logger.error('❌ Failed to save orders:', error);
      throw error;
    }
  }
  async findRecentOrders(
    fromDate: Date,
    limit: number = 100,
  ): Promise<Order[]> {
    return this.orderModel
      .find({
        'GeneralInfo.ReceivedDate': { $gte: fromDate },
      })
      .sort({ 'GeneralInfo.ReceivedDate': -1 })
      .limit(limit)
      .exec();
  }

  async incrementRetryCount(orderId: string): Promise<void> {
    await this.orderModel
      .updateOne({ orderId }, { $inc: { retryCount: 1 } })
      .exec();
  }

  async getOrderStats(): Promise<any> {
    return this.orderModel
      .aggregate([
        {
          $group: {
            _id: '$processingStatus',
            count: { $sum: 1 },
          },
        },
      ])
      .exec();
  }

  async findOrdersByStatus(syncStatus: string): Promise<Order[]> {
    return this.orderModel
      .find({ syncStatus })
      .sort({ createdAt: 1 }) // Oldest first
      .limit(10) // Process max 10 at a time
      .exec();
  }

  async updateSyncStatus(
    orderId: string,
    status: string,
    error?: string,
  ): Promise<void> {
    const update: any = {
      syncStatus: status,
      syncedAt: status === 'synced' ? new Date() : undefined,
      syncError: error || undefined,
    };

    if (status === 'failed') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      update.$inc = { syncRetries: 1 };
    }

    await this.orderModel.updateOne({ _id: orderId }, update).exec();
  }
}
