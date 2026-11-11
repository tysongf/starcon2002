import { Type, type Static } from '@sinclair/typebox';

export const DecipherPrecursorSiteSchema = Type.Object({
  freq: Type.Number(),
  phase: Type.Number(),
  damping: Type.Number(),
  playerId: Type.Optional(Type.String()),
});
export type DecipherPrecursorSiteInput = Static<typeof DecipherPrecursorSiteSchema>;

export const SynthesizeTechSchema = Type.Object({
  techId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type SynthesizeTechInput = Static<typeof SynthesizeTechSchema>;

export const RemitRelicSchema = Type.Object({
  count: Type.Optional(Type.Number({ minimum: 1 })),
  playerId: Type.Optional(Type.String()),
});
export type RemitRelicInput = Static<typeof RemitRelicSchema>;
