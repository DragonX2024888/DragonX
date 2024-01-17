import { buildModule } from '@nomicfoundation/hardhat-ignition/modules'

export default buildModule('TitanBuy', (m) => {
  const titanBuy = m.contract('TitanBuy')
  return { titanBuy }
})
