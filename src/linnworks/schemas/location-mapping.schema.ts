import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'location_mappings' })
export class LocationMapping {
  @Prop({ required: true, index: true, unique: true })
  zohoLocationId: string;

  @Prop({ required: true })
  zohoLocationName: string;

  @Prop({ required: true })
  linnworksLocationId: string;

  @Prop({ required: true })
  linnworksLocationName: string;
}

export const LocationMappingSchema =
  SchemaFactory.createForClass(LocationMapping);

export type LocationMappingDocument = HydratedDocument<LocationMapping>;
