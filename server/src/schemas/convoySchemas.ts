import { Type, Static } from '@sinclair/typebox';

export const ConvoyQuerySchema = Type.Object({
  sectorId: Type.Optional(Type.Integer({ minimum: 1 })),
});
export type ConvoyQuery = Static<typeof ConvoyQuerySchema>;

export const ConvoyParamSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type ConvoyParam = Static<typeof ConvoyParamSchema>;

export const EscortContractQuerySchema = Type.Object({
  accountId: Type.Optional(Type.String()),
});
export type EscortContractQuery = Static<typeof EscortContractQuerySchema>;

export const AcceptEscortBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  convoyId: Type.String({ minLength: 1 }),
});
export type AcceptEscortBody = Static<typeof AcceptEscortBodySchema>;

export const ClaimEscortBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  convoyId: Type.String({ minLength: 1 }),
});
export type ClaimEscortBody = Static<typeof ClaimEscortBodySchema>;

export const FastForwardConvoysBodySchema = Type.Object({
  deltaMinutes: Type.Optional(Type.Number({ minimum: 0.1 })),
});
export type FastForwardConvoysBody = Static<typeof FastForwardConvoysBodySchema>;

export const RaidConvoyBodySchema = Type.Object({
  convoyId: Type.String({ minLength: 1 }),
  status: Type.Optional(Type.Union([Type.Literal('SURRENDERED'), Type.Literal('DESTROYED')])),
});
export type RaidConvoyBody = Static<typeof RaidConvoyBodySchema>;

export const ResolveSkirmishBodySchema = Type.Object({
  skirmishId: Type.String({ minLength: 1 }),
  winningFactionId: Type.String({ minLength: 1 }),
  accountId: Type.Optional(Type.String()),
});
export type ResolveSkirmishBody = Static<typeof ResolveSkirmishBodySchema>;

export const DeclareAllegianceBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  skirmishId: Type.Optional(Type.String()),
  sectorId: Type.Optional(Type.Number()),
  factionId: Type.String({ minLength: 1 }),
});
export type DeclareAllegianceBody = Static<typeof DeclareAllegianceBodySchema>;

