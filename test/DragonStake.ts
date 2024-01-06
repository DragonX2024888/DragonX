import {
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXWithMaxedOutDragonStakeContract, ensureEthClaimable } from './Fixture'

describe('DragonStake', () => {
  it('Deploying a new instance should revert if total amount of stakes on currently active instance is below maximum', async () => {
    const { dragonX, user } = await loadFixture(deployDragonXFixture)
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())
    expect(await dragonStake.openedStakes()).to.be.equal(0)
    await expect(dragonX.connect(user).deployNewDragonStakeInstance()).to.be.revertedWithCustomError(dragonX, 'NoNeedForNewDragonStakeInstance')
  })
  it('Should revert if a user calls stake', async () => {
    const { dragonX, user } = await loadFixture(deployDragonXFixture)
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())
    await expect(dragonStake.connect(user).stake()).to.be.revertedWithCustomError(dragonStake, 'OwnableUnauthorizedAccount')
  })
  it('Should revert if a user calls claim', async () => {
    const { dragonX, user } = await loadFixture(deployDragonXFixture)
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())
    await expect(dragonStake.connect(user).claim()).to.be.revertedWithCustomError(dragonStake, 'OwnableUnauthorizedAccount')
  })
  it('Should revert when fallback function is triggered', async () => {
    const { genesis, dragonX } = await loadFixture(deployDragonXFixture)
    await expect(genesis.sendTransaction({
      to: await dragonX.activeDragonStakeContract(), data: '0x1234',
    })).to.be.revertedWith('Fallback triggered')
  })
  it('Should revert when a user sends ETH (only accept ETH from TitanX)', async () => {
    const { genesis, dragonX } = await loadFixture(deployDragonXFixture)
    await expect(genesis.sendTransaction({
      to: await dragonX.activeDragonStakeContract(), value: ethers.parseEther('1'),
    })).to.be.revertedWith('Sender not authorized')
  })
  it('Should gracefully ignore if no ETH is claimable', async () => {
    const { genesis } = await loadFixture(deployDragonXFixture)
    const fDragonStake = await ethers.getContractFactory('DragonStake')
    const dragonStake = await fDragonStake.deploy()

    await expect(dragonStake.connect(genesis).claim()).to.not.be.reverted
  })
  if (process.env.LONG_RUNNING_TESTS) {
    it('Should allow to deploy a new instance once the maximum number of stakes is reached', async () => {
      const fixture = await loadFixture(deployDragonXWithMaxedOutDragonStakeContract)
      const { dragonX, user, titanBuy } = fixture

      const dragonStake0 = await dragonX.activeDragonStakeContract()
      await expect(dragonX.connect(user).deployNewDragonStakeInstance()).to.not.be.reverted

      const dragonStake1 = await dragonX.activeDragonStakeContract()
      expect(await dragonX.numDragonStakeContracts()).to.be.equal(2)
      expect(await dragonX.dragonStakeContracts(0)).to.be.equal(dragonStake0)
      expect(await dragonX.dragonStakeContracts(1)).to.be.equal(dragonStake1)

      // Now create a new stake
      await ensureEthClaimable(fixture)

      // run claim
      await expect(dragonX.claim()).to.not.be.reverted

      // buy TitanX
      await expect(titanBuy.buyTitanX()).to.not.be.reverted

      // create a new stake
      const vault = await dragonX.vault()
      expect(vault).to.be.greaterThan(0n)
      await expect(dragonX.stake()).to.emit(dragonX, 'TitanStakeStarted').withArgs(dragonStake1, vault)
    })
  }
})
