import { Type, type Static } from '@sinclair/typebox';

export const RespondDialogSchema = Type.Object({
  npcId: Type.String(),
  optionIndex: Type.Number({ minimum: 0 }),
  playerId: Type.Optional(Type.String()),
});
export type RespondDialogInput = Static<typeof RespondDialogSchema>;

export const ResetDialogSchema = Type.Object({
  npcId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type ResetDialogInput = Static<typeof ResetDialogSchema>;
