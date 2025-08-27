import { Injectable } from '@nestjs/common';
import {
  AbstractWebhookStrategy,
  ZohoToLinnworksStrategy,
} from './abstract-webhook.strategy';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';
import { LinnworksApiService } from '../services/linnworks-api.service';

@Injectable()
export class SalesOrderWebhookStrategy
  extends AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  constructor(
    zohoService: ZohoBooksApiService,
    linnworksStockService: LinnworksApiService,
  ) {
    super('salesorder', zohoService, linnworksStockService);
  }
}

@Injectable()
export class PurchaseReceiveWebhookStrategy
  extends AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  constructor(
    zohoService: ZohoBooksApiService,
    linnworksStockService: LinnworksApiService,
  ) {
    super('purchasereceive', zohoService, linnworksStockService);
  }
}

@Injectable()
export class InventoryAdjustmentWebhookStrategy
  extends AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  constructor(
    zohoService: ZohoBooksApiService,
    linnworksStockService: LinnworksApiService,
  ) {
    super('inventory_adjustment', zohoService, linnworksStockService);
  }
}

@Injectable()
export class VendorCreditWebhookStrategy
  extends AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  constructor(
    zohoService: ZohoBooksApiService,
    linnworksStockService: LinnworksApiService,
  ) {
    super('vendor_credit', zohoService, linnworksStockService);
  }
}

@Injectable()
export class CreditNoteWebhookStrategy
  extends AbstractWebhookStrategy
  implements ZohoToLinnworksStrategy
{
  constructor(
    zohoService: ZohoBooksApiService,
    linnworksStockService: LinnworksApiService,
  ) {
    super('creditnote', zohoService, linnworksStockService);
  }
}
