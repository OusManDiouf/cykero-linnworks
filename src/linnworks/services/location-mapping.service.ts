import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  LocationMapping,
  LocationMappingDocument,
} from '../schemas/location-mapping.schema';
import { Model } from 'mongoose';
import { LinnworksApiService } from './linnworks-api.service';
import { ZohoBooksApiService } from '../../zoho-books/services/zoho-books-api.service';

@Injectable()
export class LocationMappingService {
  private readonly logger = new Logger(LocationMappingService.name);

  constructor(
    @InjectModel(LocationMapping.name)
    private readonly model: Model<LocationMappingDocument>,
    private readonly linnworksApi: LinnworksApiService,
    private readonly zohoApi: ZohoBooksApiService,
  ) {}

  async getByZohoId(zohoLocationId: string) {
    return this.model.findOne({ zohoLocationId }).lean().exec();
  }

  async upsert(mapping: {
    zohoLocationId: string;
    zohoLocationName: string;
    linnworksLocationId: string;
    linnworksLocationName: string;
  }) {
    await this.model
      .updateOne(
        { zohoLocationId: mapping.zohoLocationId },
        { $set: mapping },
        { upsert: true },
      )
      .exec();
  }

  /**
   * Resolve Linnworks LocationId from Zoho location (id + name for sanity).
   * Throws with actionable message if not mapped yet.
   */
  async resolveLinnworksLocationId(params: {
    zohoLocationId?: string;
    zohoLocationName?: string;
  }): Promise<string> {
    const { zohoLocationId, zohoLocationName } = params;

    if (!zohoLocationId) {
      throw new Error(
        `Missing zohoLocationId for "${zohoLocationName || 'unknown'}"`,
      );
    }

    const mapping = await this.getByZohoId(zohoLocationId);
    if (mapping?.linnworksLocationId) {
      return mapping.linnworksLocationId;
    }

    // Not mapped yet: prepare helpful context
    const lwLocations = await this.linnworksApi.getStockLocations();
    const suggestion = this.suggestByName(
      zohoLocationName || '',
      lwLocations.map((l) => l.LocationName),
    );

    this.logger.warn(
      `No mapping for Zoho ${zohoLocationName} (${zohoLocationId}). Suggested Linnworks: ${suggestion || 'none'}`,
    );

    throw new Error(
      `Location mapping missing: create mapping for Zoho (${zohoLocationName} / ${zohoLocationId})`,
    );
  }

  /**
   * Lightweight suggestion to help ops create the initial mapping (not auto-binding).
   */
  private suggestByName(
    zohoName: string,
    lwNames: string[],
  ): string | undefined {
    const z = this.normalize(zohoName);
    // exact normalized
    const exact = lwNames.find((n) => this.normalize(n) === z);
    if (exact) return exact;

    // startsWith then includes
    const starts = lwNames.find((n) => this.normalize(n).startsWith(z));
    if (starts) return starts;

    const contains = lwNames.find((n) => this.normalize(n).includes(z));
    if (contains) return contains;

    return undefined;
  }

  private normalize(s: string) {
    return (s || '')
      .toLowerCase()
      .replace(/\(warehouse\)/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
  }
}
