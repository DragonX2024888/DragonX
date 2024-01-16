import {
  loadFixture,
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import {
  deployDragonXFixture,
  deployDragonXWithMaxedOutDragonStakeContract,
  ensureEthClaimable,
  deployDragonXWithTitanXStakeActive,
} from './Fixture'
import * as Constants from './Constants'

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
  it('Should revert if trying to end stakes (with non reacing maturity)', async () => {
    const { dragonX } = await loadFixture(deployDragonXWithTitanXStakeActive)

    const stakeInfo = await dragonX.stakeReachedMaturity()
    expect(stakeInfo.hasStakesToEnd).to.be.equal(false)
    expect(stakeInfo.instanceAddress).to.be.equal(Constants.ADDRESS_ZERO)
    expect(stakeInfo.sId).to.be.equal(0n)

    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())

    // Calling function on DragonStake should revert
    await expect(dragonStake.endStakeAfterMaturity(1n)).to.be.revertedWithCustomError(dragonStake, 'StakeNotMature')
  })
  it('Should revert if calling with ID zero', async () => {
    const { dragonX } = await loadFixture(deployDragonXWithTitanXStakeActive)
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())

    // Calling function on DragonStake should revert
    await expect(dragonStake.endStakeAfterMaturity(0n)).to.be.revertedWith('invalid ID')
  })
  it('Should allow to recover TitanX', async () => {
    const { dragonX, user, swap, titanX } = await loadFixture(deployDragonXFixture)

    await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('0.5') })
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())

    const blanceBefore = await titanX.balanceOf(await dragonX.getAddress())
    expect(await titanX.balanceOf(await dragonStake.getAddress())).to.be.equal(0n)

    // user sends funds to wrong address (actor calls TitanX#endStakeForOthers)
    await titanX.connect(user).transfer(await dragonStake.getAddress(), await titanX.balanceOf(user.address))

    const recovered = await titanX.balanceOf(await dragonStake.getAddress())

    // Recover
    await expect(dragonStake.sendTitanX()).to.not.be.reverted

    // Tokens should be recovered
    expect(await titanX.balanceOf(await dragonStake.getAddress())).to.be.equal(0n)
    expect(await titanX.balanceOf(await dragonX.getAddress())).to.be.equal(blanceBefore + recovered)
  })
  it('Should revert when calling with out of range ID', async () => {
    const { dragonX } = await loadFixture(deployDragonXWithTitanXStakeActive)
    const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())

    // Calling function on DragonStake should revert
    await expect(dragonStake.endStakeAfterMaturity(2n)).to.be.revertedWith('invalid ID')
  })
  it('Should revert when someone else than DragonStake tries to do endStake accounting', async () => {
    const { dragonX, user } = await loadFixture(deployDragonXWithTitanXStakeActive)
    await expect(dragonX.connect(user).stakeEnded(100n)).to.be.revertedWith('not allowed')
  })
  it('Should allow to end stakes and update state accordingly', async () => {
    const { dragonX, titanX } = await loadFixture(deployDragonXWithTitanXStakeActive)

    let stakeInfo = await dragonX.stakeReachedMaturity()
    expect(stakeInfo.hasStakesToEnd).to.be.equal(false)
    expect(stakeInfo.instanceAddress).to.be.equal(Constants.ADDRESS_ZERO)

    // All TitanX should be staked
    expect(await dragonX.vault()).to.be.equal(0n)
    const vaultBefore = await dragonX.vault()

    while (stakeInfo.hasStakesToEnd) {
      const dragonStake = await ethers.getContractAt('DragonStake', stakeInfo.instanceAddress)
      const titanStakeInfo = await titanX.getUserStakeInfo(stakeInfo.instanceAddress, stakeInfo.sId)

      // Let stake end
      await time.increaseTo(titanStakeInfo.maturityTs)

      // End the stake
      await expect(dragonStake.endStakeAfterMaturity(stakeInfo.sId)).to.not.be.reverted

      // update
      stakeInfo = await dragonX.stakeReachedMaturity()
    }

    // After ending all stakes, all tokens should be in vault again
    const expectedAmountInVault = vaultBefore +
      await dragonX.totalTitanUnstaked()
    expect(await dragonX.vault()).to.be.equal(expectedAmountInVault)
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
