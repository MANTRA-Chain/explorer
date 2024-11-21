import { assets } from 'chain-registry';
import type { AssetDenomUnit } from '@chain-registry/types/types/assets';
import { Decimal } from '@cosmjs/math';
import {useFormatter} from '@/stores';

export function getDenomDetails(denom: string) {
  return assets.find(
    (assetList) => assetList.assets.find(
      (asset) => asset.base === denom)
  )?.assets.find((asset) => asset.base === denom);
}

export function findNonZeroExponent(denomUnits: AssetDenomUnit[]): AssetDenomUnit {
  return <AssetDenomUnit>denomUnits.find((unit) => unit.exponent !== 0)
    || { exponent: 0, base: '' };
}

export async function formatIbcToken(
  coin: { amount: string, denom: string },
  withIBCHash: boolean = true
) {
  const formatter = useFormatter();
  if (coin.denom.startsWith('ibc/')) {
    const data = await formatter.fetchDenomTrace(coin.denom)
    const assetDetail = getDenomDetails(data.base_denom)

    if (assetDetail && assetDetail.denom_units) {
      const units = findNonZeroExponent(assetDetail.denom_units)
      coin.denom = withIBCHash
        ? `${coin.denom} (${units.denom.toUpperCase()})`
        : units.denom.toUpperCase()
      coin.amount = Decimal.fromAtomics(coin.amount, units.exponent).toString()
    } else {
      coin.denom = withIBCHash  ?
        `${coin.denom} (${data.base_denom})`
        : data.base_denom
    }
  }
  return coin;
}
