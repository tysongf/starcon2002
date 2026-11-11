import { Type, type Static } from '@sinclair/typebox';

export const TradeCommoditySchema = Type.Object({
  commodityId: Type.String(),
  action: Type.Union([Type.Literal('BUY'), Type.Literal('SELL')]),
  quantity: Type.Number({ minimum: 1 }),
  playerId: Type.Optional(Type.String()),
});
export type TradeCommodityInput = Static<typeof TradeCommoditySchema>;
