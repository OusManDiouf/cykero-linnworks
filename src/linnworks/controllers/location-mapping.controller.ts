import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LocationMappingService } from '../services/location-mapping.service';

/**
 * Controller for managing location mappings between Zoho Books and Linnworks.
 * example:
 *  POST /location-mapping/upsert
 *  {
 *        "zohoLocationId": "347732000000070863",
 *        "zohoLocationName": "Cykero GmbH (Warehouse)",
 *        "linnworksLocationId": "747da01a-0162-4a5e-abc8-11ff9743378c",
 *        "linnworksLocationName": "Cykero GmbH (Warehouse)"
 *  }
 */
@Controller('location-mapping')
export class LocationMappingController {
  constructor(
    private readonly mapping: LocationMappingService,
    // Those services are not needed as we can just use the payload we have
    // If we need to use a real call service instead of constructing the payload beforehand, we can do so here using those services:
    // Need to add a call to zoho books to get the locations first, linnworks srv already provides the locations
    // private readonly lw: LinnworksApiService,
    // private readonly zoho: ZohoBooksApiService,
  ) {}

  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  async upsert(
    @Body()
    body: {
      zohoLocationId: string;
      zohoLocationName: string;
      linnworksLocationId: string;
      linnworksLocationName: string;
    },
  ) {
    if (!body?.zohoLocationId || !body?.linnworksLocationId) {
      return {
        ok: false,
        error: 'zohoLocationId and linnworksLocationId are required',
      };
    }
    await this.mapping.upsert(body);
    const confirm = await this.mapping.getByZohoId(body.zohoLocationId);
    return { ok: true, confirm };
  }
}
