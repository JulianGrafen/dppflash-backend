import { z } from 'zod';
import { DppSchemaVersion } from '@/app/domain/models/DppModel';

export const percentageSchema = z
  .number()
  .finite()
  .min(0, 'Percentage values must be >= 0.')
  .max(100, 'Percentage values must be <= 100.');

const optionalNonEmptyStringSchema = z
  .string()
  .trim()
  .min(1)
  .optional();

export const materialSchema = z.object({
  name: z.string().trim().min(1, 'Material name is required.'),
  casNumber: optionalNonEmptyStringSchema,
  percentage: percentageSchema,
  isRecycled: z.boolean(),
});

export const substanceSchema = z.object({
  name: z.string().trim().min(1, 'Substance name is required.'),
  casNumber: z.string().trim().min(1, 'Substance CAS number is required.'),
  concentration: percentageSchema,
  hazardStatement: z.string().trim().min(1, 'Hazard statement is required.'),
});

export const dppPayloadSchema = z.object({
  schemaVersion: z.literal(DppSchemaVersion.EsprV1),
  identification: z.object({
    upi: z.string().trim().min(1, 'UPI is required.'),
    gtin: optionalNonEmptyStringSchema,
    batchNumber: z.string().trim().min(1, 'Batch number is required.'),
    taricCode: z.string().trim().min(1, 'TARIC code is required.'),
  }),
  manufacturer: z.object({
    name: z.string().trim().min(1, 'Manufacturer name is required.'),
    address: z.string().trim().min(1, 'Manufacturer address is required.'),
    vatId: z.string().trim().min(1, 'Manufacturer VAT ID is required.'),
  }),
  composition: z.array(materialSchema).min(1, 'Composition must contain at least one material.'),
  substancesOfConcern: z.array(substanceSchema),
  environmentalImpact: z.object({
    carbonFootprint: z.number().finite().nonnegative('Carbon footprint must not be negative.').optional(),
    waterFootprint: z.number().finite().nonnegative('Water footprint must not be negative.').optional(),
  }),
  circularity: z.object({
    shelfLifeInMonths: z.number().finite().nonnegative('Shelf life must not be negative.'),
    disposalInstructions: z.string().trim().min(1, 'Disposal instructions are required.'),
  }),
});

export type ValidatedDppPayload = z.infer<typeof dppPayloadSchema>;
