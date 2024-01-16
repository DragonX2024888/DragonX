import {
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture } from './Fixture'

describe('Build on DragonX', () => {
  it('Should allow any contract to contribute to the DragonX vault', async () => {
    const { dragonX, swap, user, titanX } = await loadFixture(deployDragonXFixture)
    const fBuildOnDragonX = await ethers.getContractFactory('BuildOnDragonX')
    const buildOnDragonX = await fBuildOnDragonX.deploy()

    // Buy some TitanX
    await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })
    const expectedVaultBalance = await titanX.balanceOf(user.address)

    // Fund BuildOnDragonX
    await titanX.connect(user).transfer(await buildOnDragonX.getAddress(), expectedVaultBalance)

    // BuildOnDragonX now sends to DragonX vault
    await buildOnDragonX.sendToDragonVault(await dragonX.getAddress())

    // Check vault
    expect(await dragonX.vault()).to.be.equal(expectedVaultBalance)
  })
})
