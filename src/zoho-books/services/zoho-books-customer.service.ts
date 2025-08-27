// zoho-books/services/zoho-customer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ZohoBooksApiService } from './zoho-books-api.service';
import { OrderDto } from '../../linnworks/dto/order.dto';
import { buildCreateZohoCustomerParams } from '../transformers/zoho-customer-params.builder';

@Injectable()
export class ZohoBooksCustomerService {
  private readonly logger = new Logger(ZohoBooksCustomerService.name);

  constructor(private readonly zohoApi: ZohoBooksApiService) {}

  /**
   * Ensures a Zoho customer exists for the given order.
   * Strategy:
   *  - If email exists, try to find it by email
   *  - If found, return it
   *  - Otherwise create a new customer from order data
   */
  async ensureCustomerForOrder(order: OrderDto): Promise<{
    success: boolean;
    customerId?: string;
    createdNew?: boolean;
    errorMessage?: string;
  }> {
    const email = order?.CustomerInfo?.Address?.EmailAddress?.trim() || '';

    // 1) Try to find existing by email (only if we have one)
    if (email) {
      const search = await this.zohoApi.searchContactByEmail(email);
      if (search.apiError) {
        return {
          success: false,
          errorMessage: search.errorMessage || 'Zoho search error',
        };
      }
      if (search.contactExists && search.contactId) {
        this.logger.log(
          `Using existing Zoho contact ${search.contactId} for email ${email}`,
        );
        return {
          success: true,
          customerId: search.contactId,
          createdNew: false,
        };
      }
    }

    // 2) Create a new customer
    const params = buildCreateZohoCustomerParams(order);
    try {
      const created = await this.zohoApi.createCustomer(params);
      return {
        success: true,
        customerId: created.contact_id,
        createdNew: true,
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error?.message || 'Zoho create customer failed',
      };
    }
  }

  /**
   * Rollback helper to delete a just-created customer (idempotent)
   */
  async rollbackCustomer(customerId?: string): Promise<void> {
    if (!customerId) return;
    try {
      await this.zohoApi.deleteCustomer(customerId);
    } catch (error) {
      this.logger.warn(`Rollback failed for contact ${customerId}: ${error}`);
    }
  }
}
