import { Type, type Static } from '@sinclair/typebox';

export const CreateContractSchema = Type.Object({
  scavengerId: Type.String(),
  rewardCredits: Type.Number({ minimum: 100 }),
  playerId: Type.Optional(Type.String()),
});
export type CreateContractInput = Static<typeof CreateContractSchema>;

export const ClaimFrigateSchema = Type.Object({
  playerId: Type.Optional(Type.String()),
});
export type ClaimFrigateInput = Static<typeof ClaimFrigateSchema>;

export const EmergencyRecallSchema = Type.Object({
  playerId: Type.Optional(Type.String()),
});
export type EmergencyRecallInput = Static<typeof EmergencyRecallSchema>;

export const CreateWreckSchema = Type.Object({
  sectorId: Type.Number(),
  shipName: Type.String(),
  shipClass: Type.String(),
  faction: Type.String(),
  x: Type.Number(),
  y: Type.Number(),
  z: Type.Number(),
  scrapRemaining: Type.Optional(Type.Number()),
  maxScrap: Type.Optional(Type.Number()),
  hullIntactness: Type.Optional(Type.Number()),
});
export type CreateWreckInput = Static<typeof CreateWreckSchema>;

export const SalvageMineSchema = Type.Object({
  wreckId: Type.String(),
  extractAmount: Type.Number({ minimum: 1 }),
  playerId: Type.Optional(Type.String()),
});
export type SalvageMineInput = Static<typeof SalvageMineSchema>;

export const TowWreckSchema = Type.Object({
  wreckId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type TowWreckInput = Static<typeof TowWreckSchema>;

export const DismantleWreckSchema = Type.Object({
  wreckId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type DismantleWreckInput = Static<typeof DismantleWreckSchema>;

export const RefurbishWreckSchema = Type.Object({
  wreckId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type RefurbishWreckInput = Static<typeof RefurbishWreckSchema>;
