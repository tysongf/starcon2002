import { Type, Static } from '@sinclair/typebox';

export const SubmitSpecimensBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  quantity: Type.Number({ minimum: 1 }),
  speciesId: Type.Optional(Type.String()),
});
export type SubmitSpecimensBody = Static<typeof SubmitSpecimensBodySchema>;

export const ResearchProjectBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  projectId: Type.String({ minLength: 1 }),
});
export type ResearchProjectBody = Static<typeof ResearchProjectBodySchema>;

export const UpgradeBiosphereBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
});
export type UpgradeBiosphereBody = Static<typeof UpgradeBiosphereBodySchema>;

export const SynthesizeItemBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  itemId: Type.String({ minLength: 1 }),
});
export type SynthesizeItemBody = Static<typeof SynthesizeItemBodySchema>;

export const UseStimBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  stimId: Type.String({ minLength: 1 }),
});
export type UseStimBody = Static<typeof UseStimBodySchema>;

export const DebugResetBodySchema = Type.Object({
  accountId: Type.Optional(Type.String()),
});
export type DebugResetBody = Static<typeof DebugResetBodySchema>;
