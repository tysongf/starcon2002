import { Type, type Static } from '@sinclair/typebox';

export const ModifyReputationSchema = Type.Object({
  factionId: Type.String(),
  amount: Type.Number(),
  reason: Type.Optional(Type.String()),
  playerId: Type.Optional(Type.String()),
});
export type ModifyReputationInput = Static<typeof ModifyReputationSchema>;

export const DebugSetReputationSchema = Type.Object({
  factionId: Type.String(),
  standing: Type.Number(),
  playerId: Type.Optional(Type.String()),
});
export type DebugSetReputationInput = Static<typeof DebugSetReputationSchema>;

export const BrokerTruceSchema = Type.Object({
  sectorId: Type.Number(),
  factionId: Type.String(),
  tributeCredits: Type.Optional(Type.Number()),
  durationSeconds: Type.Optional(Type.Number()),
  playerId: Type.Optional(Type.String()),
});
export type BrokerTruceInput = Static<typeof BrokerTruceSchema>;

export const DebugExpireTruceSchema = Type.Object({
  sectorId: Type.Number(),
  factionId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type DebugExpireTruceInput = Static<typeof DebugExpireTruceSchema>;
