import { ignition, ethers } from 'hardhat'
import { expect } from 'chai'

import DragonX from '../ignition/modules/DragonX'

describe('Ignition', () => {
  it('Should deploy DragonX', async () => {
    const fSwap = await ethers.getContractFactory('SwapHelper')

    // Buy initial liquidity
    const swap = await fSwap.deploy()
    const titanX = await ethers.getContractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')
    const [genesis] = await ethers.getSigners()
    await swap.connect(genesis).swapETHForTitanX({ value: ethers.parseEther('28') })
    const initialLiquidity = await titanX.balanceOf(genesis.address)

    // Deploy with ignition
    const { dragonX, titanBuy, dragonBuyAndBurn } = await ignition.deploy(DragonX)

    expect(await titanBuy.dragonAddress()).to.be.equal(await dragonX.getAddress())
    expect(await dragonBuyAndBurn.dragonAddress()).to.be.equal(await dragonX.getAddress())
    expect(await dragonX.initalLiquidityMinted()).to.be.equal(1n)
    expect(await dragonX.totalSupply()).to.be.equal(initialLiquidity)
  })
})
