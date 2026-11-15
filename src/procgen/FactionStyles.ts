import {
  ALL_FACTION_IDS,
  FACTION_REGISTRY,
  type FactionHullStyle,
  type FactionMaterialProps,
  type FactionPalette,
  type FactionStructuralProps,
} from '../../shared/FactionRegistry';

export type { FactionPalette, FactionMaterialProps, FactionStructuralProps };
export type FactionStyle = Omit<FactionHullStyle, 'id'> & { id: string };

const CANONICAL_STYLES = ALL_FACTION_IDS.reduce((acc, fid) => {
  acc[fid] = FACTION_REGISTRY[fid].hullStyle;
  return acc;
}, {} as Record<string, FactionStyle>);

export const FACTION_STYLES: Record<string, FactionStyle> = {
  ...CANONICAL_STYLES,
  FACTION_VAELIC: FACTION_REGISTRY.FACTION_HEGEMONY.hullStyle,
};
