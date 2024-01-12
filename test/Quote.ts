import { ethers } from 'hardhat'

function getQuoteForSqrtRatioX96(
  sqrtRatioX96: bigint,
  baseAmount: bigint,
  baseToken: string,
  quoteToken: string,
): bigint {
  let quoteAmount: bigint
  const two = 2n
  const MAX_UINT128 = two ** 128n - 1n

  if (sqrtRatioX96 <= MAX_UINT128) {
    const ratioX192 = sqrtRatioX96 * sqrtRatioX96
    quoteAmount = baseToken < quoteToken
      ? (ratioX192 * baseAmount) / (two ** 192n)
      : (two ** 192n * baseAmount) / ratioX192
  } else {
    const ratioX128 = (sqrtRatioX96 * sqrtRatioX96) / (two ** 64n)
    quoteAmount = baseToken < quoteToken
      ? (ratioX128 * baseAmount) / (two ** 128n)
      : (two ** 128n * baseAmount) / ratioX128
  }

  return quoteAmount
}

async function getSqrtRatioX96(poolAddress: string): Promise<bigint> {
  const poolContract = await ethers.getContractAt('IUniswapV3Pool', poolAddress)
  const slot0 = await poolContract.slot0()
  return slot0.sqrtPriceX96
}

export async function quoteTitanForEth(baseAmount: bigint) {
  const sqrtRatioX96 = await getSqrtRatioX96('0xc45A81BC23A64eA556ab4CdF08A86B61cdcEEA8b')
  const baseToken = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
  const quoteToken = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1'
  const amountOut = getQuoteForSqrtRatioX96(sqrtRatioX96, baseAmount, baseToken, quoteToken)

  return amountOut
}

export async function quoteDragonForTitan(baseAmount: bigint, poolAddress: string, quoteToken: string) {
  const sqrtRatioX96 = await getSqrtRatioX96(poolAddress)
  const baseToken = '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1'
  const amountOut = getQuoteForSqrtRatioX96(sqrtRatioX96, baseAmount, baseToken, quoteToken)

  return amountOut
}
