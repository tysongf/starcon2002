import { Type, type Static } from '@sinclair/typebox';

export const FitModuleSchema = Type.Object({
  inventoryId: Type.String(),
  slot: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type FitModuleInput = Static<typeof FitModuleSchema>;

export const UnfitModuleSchema = Type.Object({
  inventoryId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type UnfitModuleInput = Static<typeof UnfitModuleSchema>;

export const BuyModuleSchema = Type.Object({
  blueprintId: Type.String(),
  customName: Type.Optional(Type.String()),
  playerId: Type.Optional(Type.String()),
});
export type BuyModuleInput = Static<typeof BuyModuleSchema>;
