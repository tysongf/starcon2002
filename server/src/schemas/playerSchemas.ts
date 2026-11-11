import { Type, type Static } from '@sinclair/typebox';

export const SpendApSchema = Type.Object({
  action: Type.String(),
  cost: Type.Optional(Type.Number()),
  playerId: Type.Optional(Type.String()),
});
export type SpendApInput = Static<typeof SpendApSchema>;

export const DebugSetApSchema = Type.Object({
  currentAP: Type.Number(),
  maxAP: Type.Optional(Type.Number()),
  playerId: Type.Optional(Type.String()),
});
export type DebugSetApInput = Static<typeof DebugSetApSchema>;

export const RefuelShipSchema = Type.Object({
  units: Type.Number({ minimum: 1 }),
  playerId: Type.Optional(Type.String()),
});
export type RefuelShipInput = Static<typeof RefuelShipSchema>;

export const DebugSetShipSchema = Type.Object({
  fuel: Type.Optional(Type.Number()),
  armor: Type.Optional(Type.Number()),
  shield: Type.Optional(Type.Number()),
  playerId: Type.Optional(Type.String()),
});
export type DebugSetShipInput = Static<typeof DebugSetShipSchema>;

export const DebugCreditsSchema = Type.Object({
  credits: Type.Number(),
  playerId: Type.Optional(Type.String()),
});
export type DebugCreditsInput = Static<typeof DebugCreditsSchema>;

export const DebugBaselineSchema = Type.Object({
  playerId: Type.Optional(Type.String()),
});
export type DebugBaselineInput = Static<typeof DebugBaselineSchema>;
