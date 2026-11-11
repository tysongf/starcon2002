import { Type, type Static } from '@sinclair/typebox';

export const PlanetScanSchema = Type.Object({
  band: Type.Union([Type.Literal('MINERALS'), Type.Literal('BIO'), Type.Literal('ANOMALIES')]),
  playerId: Type.Optional(Type.String()),
});
export type PlanetScanInput = Static<typeof PlanetScanSchema>;

export const PlanetProbeSchema = Type.Object({
  lat: Type.Number(),
  lng: Type.Number(),
  boostShield: Type.Optional(Type.Boolean()),
  playerId: Type.Optional(Type.String()),
});
export type PlanetProbeInput = Static<typeof PlanetProbeSchema>;

export const SellSurveyDataSchema = Type.Object({
  playerId: Type.Optional(Type.String()),
});
export type SellSurveyDataInput = Static<typeof SellSurveyDataSchema>;

export const DebugResetSurveySchema = Type.Object({
  planetId: Type.String(),
  playerId: Type.Optional(Type.String()),
});
export type DebugResetSurveyInput = Static<typeof DebugResetSurveySchema>;
