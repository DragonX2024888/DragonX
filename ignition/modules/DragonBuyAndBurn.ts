import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('DragonBuyAndBurn', (m) => {
  const dragonBuyAndBurn = m.contract('DragonBuyAndBurn')
  return { dragonBuyAndBurn }
})
