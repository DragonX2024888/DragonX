import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('DragonX', (m) => {
  // Deploy contracts
  const titanBuy = m.contract('TitanBuy')
  const dragonBuyAndBurn = m.contract('DragonBuyAndBurn')
  const dragonX = m.contract('DragonX', [titanBuy, dragonBuyAndBurn])

  // Initialise TitanBuy and DragonBuyAndBurn
  const setDragonContractAddressOnTitanBuy = m.call(titanBuy, 'setDragonContractAddress', [dragonX])
  const setDragonContractAddressOnDragonBuyAndBurn = m.call(dragonBuyAndBurn, 'setDragonContractAddress', [dragonX])

  // Setup initial liquidity
  const titanX = m.contractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')

  // Use complete balance of genesis for initial liquidity
  const genesis = m.getAccount(0)
  const initialLiquidity = m.staticCall(titanX, 'balanceOf', [genesis])
  const approve = m.call(titanX, 'approve', [dragonBuyAndBurn, genesis])
  m.call(dragonBuyAndBurn, 'createInitialLiquidity', [initialLiquidity], {
    after: [setDragonContractAddressOnTitanBuy, setDragonContractAddressOnDragonBuyAndBurn, approve],
  })

  return { dragonX, titanBuy, dragonBuyAndBurn }
})
