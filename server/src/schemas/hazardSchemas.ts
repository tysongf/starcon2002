import { Type, Static } from '@sinclair/typebox';

export const PlanetParamSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type PlanetParam = Static<typeof PlanetParamSchema>;

export const PurchaseLanderBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  tier: Type.Optional(Type.Integer({ minimum: 1, maximum: 4 })),
});
export type PurchaseLanderBody = Static<typeof PurchaseLanderBodySchema>;

export const ClaimLoanerBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
});
export type ClaimLoanerBody = Static<typeof ClaimLoanerBodySchema>;

export const EquipModuleBodySchema = Type.Object({
  accountId: Type.String({ minLength: 1 }),
  slot: Type.Union([
    Type.Literal('thermal'),
    Type.Literal('electrical'),
    Type.Literal('caustic'),
    Type.Literal('cargo'),
  ]),
  moduleId: Type.String({ minLength: 1 }),
});
export type EquipModuleBody = Static<typeof EquipModuleBodySchema>;

