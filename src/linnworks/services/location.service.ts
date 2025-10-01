import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationService {
  // Default Linnworks Location GUID to poll/use when the order doesn't specify one
  getDefaultLinnworksLocationId(): string {
    return (
      process.env.LINNWORKS_LOCATION_ID ||
      '00000000-0000-0000-0000-000000000000'
    );
  }

  // Prefer the order’s FulfilmentLocationId if present, otherwise default
  getOrderLinnworksLocationId(order?: {
    FulfilmentLocationId?: string;
  }): string {
    return (
      order?.FulfilmentLocationId?.trim() ||
      this.getDefaultLinnworksLocationId()
    );
  }

  // Map Linnworks Location GUID -> Zoho location_id
  // Configure as: ZOHO_WAREHOUSE_BY_LOCATION="linnGuid1:zohoId1,linnGuid2:zohoId2"
  mapLinnworksToZohoLocationId(
    linnworksLocationId?: string,
  ): string | undefined {
    const mapping = (process.env.ZOHO_WAREHOUSE_BY_LOCATION || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, pair) => {
        const [linn, zoho] = pair.split(':').map((s) => s.trim());
        if (linn && zoho) acc[linn] = zoho;
        return acc;
      }, {});

    const key =
      (linnworksLocationId || '').trim() ||
      this.getDefaultLinnworksLocationId();

    return mapping[key];
  }
}
