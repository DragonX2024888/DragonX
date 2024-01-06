import { ethers } from 'hardhat'

const errors = [
  'TitanX_InvalidAmount()',
  'TitanX_InsufficientBalance()',
  'TitanX_NotSupportedContract()',
  'TitanX_InsufficientProtocolFees()',
  'TitanX_FailedToSendAmount()',
  'TitanX_NotAllowed()',
  'TitanX_NoCycleRewardToClaim()',
  'TitanX_NoSharesExist()',
  'TitanX_EmptyUndistributeFees()',
  'TitanX_InvalidBurnRewardPercent()',
  'TitanX_InvalidBatchCount()',
  'TitanX_InvalidMintLadderInterval()',
  'TitanX_InvalidMintLadderRange()',
  'TitanX_MaxedWalletMints()',
  'TitanX_LPTokensHasMinted()',
  'TitanX_InvalidAddress()',
  'TitanX_InsufficientBurnAllowance()',
  'TitanX_InvalidStakeLength()',
  'TitanX_RequireOneMinimumShare()',
  'TitanX_ExceedMaxAmountPerStake()',
  'TitanX_NoStakeExists()',
  'TitanX_StakeHasEnded()',
  'TitanX_StakeNotMatured()',
  'TitanX_StakeHasBurned()',
  'TitanX_MaxedWalletStakes()',
]

const errorCodes = errors.reduce((acc, error) => {
  acc[error] = ethers.keccak256(Buffer.from(error)).toString()
  return acc
}, {} as Record<string, string>)

console.log(errorCodes)
