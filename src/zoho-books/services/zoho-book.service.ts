import { Injectable } from '@nestjs/common';
import { ZohoAuthService } from './zoho-auth.service';
import { ConfigService } from '@nestjs/config';
import {
  Warehouse,
  ZohoBookItem,
  ZohoBookItemResponse,
  ZohoBookItemsResponse,
} from '../types/zoho-books-types';
import Bottleneck from 'bottleneck';

@Injectable()
export class ZohoBookService {
  private readonly GMBH_WAREHOUSE_ID = '347732000000070863';

  private readonly ZOHO_BOOK_API: string;
  private readonly ORGANIZATION_ID: string;

  private readonly limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 500,
  });

  constructor(
    private readonly zohoAuthService: ZohoAuthService,
    private readonly configService: ConfigService,
  ) {
    if (!this.configService.get('ZOHO_BOOK_API')) {
      throw new Error('ZOHO_BOOK_API is not set');
    }
    if (!this.configService.get('ZOHO_BOOK_ORGANIZATION_ID')) {
      throw new Error('ZOHO_BOOK_ORGANIZATION_ID is not set');
    }
    this.ZOHO_BOOK_API = this.configService.get('ZOHO_BOOK_API') as string;
    this.ORGANIZATION_ID = this.configService.get(
      'ZOHO_BOOK_ORGANIZATION_ID',
    ) as string;
  }

  private async getAccessToken(): Promise<string> {
    return this.zohoAuthService.getAccessToken();
  }

  async getItem(itemId: string): Promise<ZohoBookItem | undefined> {
    const url = `${this.ZOHO_BOOK_API}/items/${itemId}`;
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'X-com-zoho-organizationid': this.ORGANIZATION_ID,
      },
    });
    if (!response.ok) {
      const result = await response.text();
      throw new Error(`Failed to get item: ${result}`);
    }
    const { item } = (await response.json()) as ZohoBookItemResponse;
    return item;
  }

  public async fetchZohoWarehouseStocks(
    items: ZohoBookItem[],
  ): Promise<{ item_id: string; sku: string; warehouseStock: number }[]> {
    const marginalAndFunctionalItems = this.keepOnlyMarginalAndFunctionalItems(
      items.map((item) => ({
        item_id: item.item_id,
        sku: item.sku,
      })),
    );

    const stockPromises = marginalAndFunctionalItems.map((item) =>
      this.getItemWarehouseStockFromZoho(item),
    );

    return Promise.all(stockPromises);
  }

  private keepOnlyMarginalAndFunctionalItems(
    zohoBookItems: { item_id: string; sku: string }[],
  ) {
    return zohoBookItems.filter((item) => item.sku.endsWith('/M/1'));
  }

  private async getItemWarehouseStockFromZoho(item: {
    item_id: string;
    sku: string;
  }): Promise<{ item_id: string; sku: string; warehouseStock: number }> {
    const itemDetails = await this.getItemDetails(item.item_id);
    const warehouseStock = this.calculateTotalAvailableStock(
      itemDetails.warehouses,
    );

    return {
      item_id: item.item_id,
      sku: item.sku,
      warehouseStock,
    };
  }

  private calculateTotalAvailableStock(warehouses: Warehouse[]) {
    return warehouses.reduce((reducedWarehouseStock, warehouse) => {
      if (warehouse.warehouse_id === this.GMBH_WAREHOUSE_ID) {
        reducedWarehouseStock +=
          warehouse.warehouse_actual_available_for_sale_stock;
      }
      return reducedWarehouseStock;
    }, 0);
  }

  public async fetchZohoItemsForSkuStartingWith(
    skuPrefix: string,
    currentPage: number = 1,
  ): Promise<ZohoBookItem[]> {
    const url = `${this.ZOHO_BOOK_API}/items`;
    const urlParams = new URLSearchParams();
    urlParams.append('organization_id', this.ORGANIZATION_ID);
    urlParams.append('page', currentPage.toString());
    urlParams.append('per_page', '200');
    urlParams.append('filter_by', 'Status.Active');
    urlParams.append('sku_startswith', skuPrefix);
    const urlWithParams = `${url}?${urlParams.toString()}`;

    const response = await this.scheduledFetch(urlWithParams);

    const data = (await response.json()) as ZohoBookItemsResponse;

    if (!response.ok) {
      throw new Error(
        `Failed to get items: ${data.message || 'Unknown error'}`,
      );
    }
    const items = data.items;
    const hasMorePage = data.page_context.has_more_page;

    return [
      ...items,
      ...(hasMorePage
        ? await this.fetchZohoItemsForSkuStartingWith(
            skuPrefix,
            currentPage + 1,
          )
        : []),
    ];
  }

  private async getItemDetails(item_id: string) {
    const url = `${this.ZOHO_BOOK_API}/items/${item_id}`;
    const urlParams = new URLSearchParams();
    urlParams.append('organization_id', this.ORGANIZATION_ID);
    const urlWithParams = `${url}?${urlParams.toString()}`;

    const response = await this.scheduledFetch(urlWithParams);

    const data = (await response.json()) as ZohoBookItemResponse;
    if (!response.ok) {
      throw new Error(
        `Failed to get item details: ${data.message || 'Unknown error'}`,
      );
    }
    if (!data.item) {
      throw new Error(`Item not found: ${item_id}`);
    }
    return data.item;
  }

  private async scheduledFetch(
    url: string,
    method: string = 'GET',
    body?: any,
    customHeaders?: Record<string, string>,
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();
    const headers = {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      'X-com-zoho-organizationid': this.ORGANIZATION_ID,
      ...customHeaders,
    };

    return this.limiter.schedule(() =>
      fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  }
}
