import { Type, type Static } from '@sinclair/typebox';

export const JumpSectorSchema = Type.Object({
  targetSectorId: Type.Number(),
  playerId: Type.Optional(Type.String()),
});
export type JumpSectorInput = Static<typeof JumpSectorSchema>;
