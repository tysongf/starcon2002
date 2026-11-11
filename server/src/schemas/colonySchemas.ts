import { Type, type Static } from '@sinclair/typebox';

export const FoundColonySchema = Type.Object({
  planetId: Type.String(),
  beaconId: Type.String(),
  colonyName: Type.String({ minLength: 3 }),
  playerId: Type.Optional(Type.String()),
});
export type FoundColonyInput = Static<typeof FoundColonySchema>;

export const UpgradeFacilitySchema = Type.Object({
  facilityType: Type.Union([
    Type.Literal('DERRICK'),
    Type.Literal('HABITATION'),
    Type.Literal('TERRAFORMER'),
    Type.Literal('SILO'),
  ]),
  playerId: Type.Optional(Type.String()),
});
export type UpgradeFacilityInput = Static<typeof UpgradeFacilitySchema>;

export const HarvestColonySchema = Type.Object({
  playerId: Type.Optional(Type.String()),
});
export type HarvestColonyInput = Static<typeof HarvestColonySchema>;

export const DebugFastForwardColonySchema = Type.Object({
  colonyId: Type.String(),
  seconds: Type.Number({ minimum: 1 }),
  playerId: Type.Optional(Type.String()),
});
export type DebugFastForwardColonyInput = Static<typeof DebugFastForwardColonySchema>;
