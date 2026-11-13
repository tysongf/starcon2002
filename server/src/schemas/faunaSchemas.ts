import { Type, Static } from '@sinclair/typebox';

export const PlanetParamSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type PlanetParam = Static<typeof PlanetParamSchema>;

export const DeployLanderBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
});
export type DeployLanderBody = Static<typeof DeployLanderBodySchema>;

export const HarvestedMineralSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 0 }),
  commodityId: Type.Optional(Type.String()),
});

export const HarvestedBioSampleSchema = Type.Object({
  speciesId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 0 }),
  bioUnits: Type.Number({ minimum: 0 }),
  speciesClass: Type.Optional(Type.String()),
});

export const RecoverLanderBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  mineralsHarvested: Type.Array(HarvestedMineralSchema),
  bioSamplesHarvested: Type.Array(HarvestedBioSampleSchema),
  hullRemaining: Type.Number({ minimum: 0, maximum: 250 }),
  fuelRemaining: Type.Number({ minimum: 0, maximum: 250 }),
});
export type RecoverLanderBody = Static<typeof RecoverLanderBodySchema>;

export const StashCargoBodySchema = RecoverLanderBodySchema;
export type StashCargoBody = RecoverLanderBody;

export const TitanHitBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  speciesId: Type.String({ minLength: 1 }),
});
export type TitanHitBody = Static<typeof TitanHitBodySchema>;

