import { Injectable, Logger } from '@nestjs/common';
import { LinnworksApiService } from './linnworks-api.service';
import { OrderRepositoryService } from './order-repository.service';
import { OrderDto } from '../dto/order.dto';
import { LocationService } from './location.service';

@Injectable()
export class OrderProcessorService {
  private readonly logger = new Logger(OrderProcessorService.name);

  constructor(
    private readonly linnworksApi: LinnworksApiService,
    private readonly orderRepository: OrderRepositoryService,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Check if order is ready for processing (not empty/draft)
   */
  private isOrderReady(order: OrderDto): boolean {
    const hasItems = Array.isArray(order.Items) && order.Items.length > 0;

    const hasValue = order.TotalsInfo?.TotalCharge > 0;

    const hasRealStatus = order.GeneralInfo?.Status > 0;

    const hasCustomerInfo = !!(
      order.CustomerInfo?.Address?.FullName?.trim() ||
      order.CustomerInfo?.Address?.EmailAddress?.trim()
    );

    return hasItems && hasValue && hasRealStatus && hasCustomerInfo;
  }

  /**
   * Main processing logic
   */
  async processOpenOrders(): Promise<{
    totalOpenOrders: number;
    newOrders: number;
    readyOrders: number;
    skippedEmptyOrders: number;
    savedOrders: number;
  }> {
    try {
      // Step 1: Fetch open order ids for the specific fulfilment center (location)
      const fulfilmentCenter =
        this.locationService.getDefaultLinnworksLocationId();
      const openOrderIds = await this.linnworksApi.getAllOpenOrderIds({
        fulfilmentCenter,
      });
      this.logger.debug(
        `🔍️  Found ${openOrderIds.length} open orders from Linnworks`,
      );

      // Step 2: Discard already saved open order ids
      const savedOrderIds = await this.orderRepository.getSavedOrderIds();
      const savedOrderIdsSet = new Set(savedOrderIds);

      const newOrderIds = openOrderIds.filter(
        (id) => !savedOrderIdsSet.has(id),
      );
      this.logger.debug(
        `ℹ️  Found ${newOrderIds.length} new orders to process`,
      );

      if (newOrderIds.length === 0) {
        return {
          totalOpenOrders: openOrderIds.length,
          newOrders: 0,
          readyOrders: 0,
          skippedEmptyOrders: 0,
          savedOrders: 0,
        };
      }

      // Step 3: Fetch not already present open order details
      const orderDetails = await this.linnworksApi.getOpenOrderDetailsByIds({
        OrderIds: newOrderIds,
      });
      this.logger.debug(`Fetched details for ${orderDetails.length} orders`);

      // Step 4: Filter out empty/draft orders
      const readyOrders = orderDetails.filter((order) =>
        this.isOrderReady(order),
      );
      const skippedCount = orderDetails.length - readyOrders.length;

      if (skippedCount > 0) {
        this.logger.debug(`🧹  Skipped ${skippedCount} empty/draft orders`);
      }

      if (readyOrders.length === 0) {
        this.logger.debug('ℹ️  No ready orders to save');
        return {
          totalOpenOrders: openOrderIds.length,
          newOrders: newOrderIds.length,
          readyOrders: 0,
          skippedEmptyOrders: skippedCount,
          savedOrders: 0,
        };
      }

      // Step 5: Save ready orders to database
      await this.orderRepository.saveOrders(readyOrders);

      this.logger.log(
        `✅  Processing complete: ${openOrderIds.length} total, ${newOrderIds.length} new, ${readyOrders.length} ready, ${skippedCount} skipped, ${readyOrders.length} saved`,
      );

      return {
        totalOpenOrders: openOrderIds.length,
        newOrders: newOrderIds.length,
        readyOrders: readyOrders.length,
        skippedEmptyOrders: skippedCount,
        savedOrders: readyOrders.length,
      };
    } catch (error) {
      this.logger.error('❌  Failed to process open orders:', error);
      throw error;
    }
  }
}
