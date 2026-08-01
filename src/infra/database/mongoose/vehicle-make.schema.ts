import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import {
  VehicleMake,
  VehicleType,
} from '../../../domain/vehicles/enterprise/entities/vehicle-make';

const vehicleTypeSchema = new MongooseSchema<VehicleType>(
  {
    typeId: { type: Number, required: true },
    typeName: { type: String, required: true },
  },
  { _id: false },
);

@Schema({ collection: 'vehicle_makes', versionKey: false })
export class VehicleMakeDocument implements VehicleMake {
  @Prop({ required: true, unique: true })
  makeId!: number;

  @Prop({ required: true })
  makeName!: string;

  @Prop({ type: [vehicleTypeSchema], default: [] })
  vehicleTypes!: VehicleType[];
}

export const VehicleMakeSchema = SchemaFactory.createForClass(VehicleMakeDocument);
