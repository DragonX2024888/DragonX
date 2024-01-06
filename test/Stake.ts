import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXUserHasMintedFixture, deployDragonXWithMaxedOutDragonStakeContract } from './Fixture'
import * as Constants from './Constants'

describe('Stake', () => {
  it('Should revert if vault is empty', async () => {
    const { dragonX, user } = await loadFixture(deployDragonXFixture)
    await expect(dragonX.connect(user).stake()).to.be.revertedWithCustomError(dragonX, 'NoTokensToStake')
  })
  it('Should allow to open a stake immediately when more than 100B TitanX in vault', async () => {
    const { dragonX, titanX, user, swap } = await loadFixture(deployDragonXFixture)

    // Make a massive TitanX buy
    await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('200') })

    // Make sure to have enough TitanX to hit cap
    const balance = await titanX.balanceOf(user.address)
    expect(balance).to.be.greaterThanOrEqual(Constants.TITANX_BPB_MAX_TITAN)

    // mint
    await time.increaseTo(await dragonX.mintPhaseBegin())
    await titanX.connect(user).approve(await dragonX.getAddress(), balance)
    await expect(dragonX.connect(user).mint(balance)).to.not.be.reverted

    // make sure cooldown is active
    expect(await dragonX.nextStakeTs()).to.be.greaterThan(await time.latest())

    // now open a stake activeDragonStakeContract, totalTitanStaked
    const toStake = await dragonX.vault()
    await expect(dragonX.connect(user).stake())
      .to.emit(dragonX, 'TitanStakeStarted')
      .withArgs(await dragonX.activeDragonStakeContract(), toStake)

    // Ensure state updates
    expect(await dragonX.totalTitanStaked()).to.be.equal(toStake)
  })
  it('Should revert if staking is called within cooldown period', async () => {
    const { user, dragonX, titanX, swap, others } = await loadFixture(deployDragonXUserHasMintedFixture)
    await time.increaseTo(await dragonX.nextStakeTs())
    await expect(dragonX.connect(user).stake()).to.not.be.reverted

    const otherUser = others[0]
    await swap.connect(otherUser).swapETHForTitanX({ value: ethers.parseEther('1') })
    const balance = await titanX.balanceOf(otherUser.address)
    await titanX.connect(otherUser).approve(await dragonX.getAddress(), balance)
    await dragonX.connect(otherUser).mint(balance)

    // call again, should be in cooldown
    await expect(dragonX.connect(user).stake()).to.be.revertedWithCustomError(dragonX, 'CooldownPeriodActive')
  })
  if (process.env.LONG_RUNNING_TESTS) {
    it('Should revert if the maximum numbers of stakes per DragonStake is reached', async () => {
      const fixture = await loadFixture(deployDragonXWithMaxedOutDragonStakeContract)
      const { dragonX, user } = fixture
      await expect(dragonX.connect(user).stake()).to.be.revertedWithCustomError(dragonX, 'NoAdditionalStakesAllowed')
    })
  }
})
