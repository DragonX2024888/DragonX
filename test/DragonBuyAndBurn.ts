import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { EventLog } from 'ethers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import * as progress from 'cli-progress'

import { deployDragonXFixture, deployDragonXUserHasMintedFixture, ensureEthClaimable } from './Fixture'
import * as Constants from './Constants'

describe('DragonBuyAndBurn', () => {
  it('Should revert if DragonX address is not set', async () => {
    const fDragonBuyAndBurn = await ethers.getContractFactory('DragonBuyAndBurn')
    const dragonBuyAndBurn = await fDragonBuyAndBurn.deploy()

    await expect(dragonBuyAndBurn.buyAndBurnDragonX()).to.be.revertedWithCustomError(dragonBuyAndBurn, 'InvalidDragonAddress')
  })
  it('Should revert if DragonBuyAndBurn is called by a bot', async () => {
    const { dragonBuyAndBurn } = await loadFixture(deployDragonXFixture)
    const TriggerBot = await ethers.getContractFactory('TriggerBot')
    const triggerBot = await TriggerBot.deploy()

    await expect(triggerBot.triggerDragonBuyAndBurn(await dragonBuyAndBurn.getAddress()))
      .to.be.revertedWithCustomError(dragonBuyAndBurn, 'InvalidCaller')
  })
  it('Should revert if there is no ETH to buy', async () => {
    const { dragonBuyAndBurn, user } = await loadFixture(deployDragonXFixture)

    await expect(dragonBuyAndBurn.connect(user).buyAndBurnDragonX())
      .to.be.revertedWithCustomError(dragonBuyAndBurn, 'NoWethToBuyAndBurnDragon')
  })
  it('Should revert when triggered while cooldown is active', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonX, dragonBuyAndBurn } = fixture

    // Trigger claim (this will distribute to TitanBuy)
    await ensureEthClaimable(fixture)
    await dragonX.claim()

    // Buy TitanX
    await expect(dragonBuyAndBurn.buyAndBurnDragonX()).to.not.be.reverted

    // Call again
    await expect(dragonBuyAndBurn.buyAndBurnDragonX()).to.be.revertedWithCustomError(dragonBuyAndBurn, 'CooldownPeriodActive')
  })
  it('Should cap the maximum amount of ETH per TitanX buy', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonX, dragonBuyAndBurn, swap, user, titanX } = fixture

    // Let user buy some decent amount of TitanX
    await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('100') })

    // User mints DragonX
    const balance = await titanX.balanceOf(user.address)
    await titanX.connect(user).approve(await dragonX.getAddress(), balance)
    await dragonX.connect(user).mint(balance)

    // Trigger claim (this will distribute to TitanBuy)
    const dragonBuyAndBurnAddress = await dragonBuyAndBurn.getAddress()
    const capPerSwap = await dragonBuyAndBurn.capPerSwap()
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)
    while (await weth.balanceOf(dragonBuyAndBurnAddress) <= capPerSwap) {
      await ensureEthClaimable(fixture)
      await dragonX.claim()
    }

    const balanceBefore = await weth.balanceOf(dragonBuyAndBurnAddress)
    const incentiveFee = (capPerSwap * Constants.INCENTIVE_FEE) / Constants.BASIS

    // Buy TitanX
    expect(balanceBefore).to.be.equal(await dragonBuyAndBurn.totalWethForBuyAndBurn())
    expect(capPerSwap).to.be.equal(await dragonBuyAndBurn.wethForNextBuyAndBurn())
    expect(incentiveFee).to.be.equal(await dragonBuyAndBurn.incentiveFeeForRunningBuyAndBurnDragonX())
    await expect(dragonBuyAndBurn.buyAndBurnDragonX()).to.not.be.reverted
    expect(await weth.balanceOf(dragonBuyAndBurnAddress)).to.be.equal(balanceBefore - capPerSwap)
  })
  it('Should revert when fallback function is triggered', async () => {
    const { genesis, dragonBuyAndBurn } = await loadFixture(deployDragonXFixture)
    await expect(genesis.sendTransaction({
      to: await dragonBuyAndBurn.getAddress(), data: '0x1234',
    })).to.be.revertedWith('Fallback triggered')
  })
  it('Should updates states correctly and emit an event', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { user, dragonBuyAndBurn, dragonX } = fixture
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)

    // prepare claim
    await ensureEthClaimable(fixture)

    // claim
    await dragonX.connect(user).claim()

    // Prepare
    let balanceBefore = await weth.balanceOf(await dragonBuyAndBurn.getAddress())
    const dragonTotalSupplyBefore = await dragonX.totalSupply()
    let incentiveFee = (balanceBefore * Constants.INCENTIVE_FEE) / Constants.BASIS
    expect(await dragonBuyAndBurn.totalWethUsedForBuyAndBurns()).to.be.equal(0n)
    expect(await dragonBuyAndBurn.totalDragonBurned()).to.be.equal(0n)
    const userEthBalanceBefore = await ethers.provider.getBalance(user.address)
    let expectedWethForBuyAndBurn = balanceBefore - incentiveFee
    if (balanceBefore > await dragonBuyAndBurn.capPerSwap()) {
      expectedWethForBuyAndBurn = balanceBefore - await dragonBuyAndBurn.capPerSwap() - incentiveFee
    }

    // Buy and burn DragonX
    let tx = await dragonBuyAndBurn.connect(user).buyAndBurnDragonX()
    let receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    let event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'BoughtAndBurned') as EventLog
    expect(receipt).not.to.be.null
    expect(event.args.weth).to.be.equal(expectedWethForBuyAndBurn)
    expect(await weth.balanceOf(await dragonBuyAndBurn.getAddress()))
      .to.be.equal(balanceBefore - expectedWethForBuyAndBurn - incentiveFee)
    expect(event.args.caller).to.be.equal(user.address)

    // State updates of other contracts
    const dragonBurned = event.args.dragon as bigint
    expect(await dragonX.totalSupply()).to.be.equal(dragonTotalSupplyBefore - dragonBurned)

    // State variables
    expect(await dragonBuyAndBurn.totalWethUsedForBuyAndBurns()).to.be.equal(expectedWethForBuyAndBurn)
    expect(await dragonBuyAndBurn.totalDragonBurned()).to.be.equal(dragonBurned)

    // Consider TX fee and Incentive Fee
    const totalFee = receipt.gasUsed * receipt.gasPrice
    const userExpectedEthBalance = userEthBalanceBefore - totalFee + incentiveFee
    expect(await ethers.provider.getBalance(user.address)).to.be.equal(userExpectedEthBalance)

    // Do a second run to ensure state update
    // prepare claim
    await ensureEthClaimable(fixture)

    // claim
    await dragonX.connect(user).claim()

    // prepare
    balanceBefore = await weth.balanceOf(await dragonBuyAndBurn.getAddress())
    incentiveFee = (balanceBefore * Constants.INCENTIVE_FEE) / Constants.BASIS
    let expectedWethForBuyAndBurn2 = balanceBefore - incentiveFee
    if (balanceBefore > await dragonBuyAndBurn.capPerSwap()) {
      expectedWethForBuyAndBurn2 = balanceBefore - await dragonBuyAndBurn.capPerSwap() - incentiveFee
    }

    const nextInterval = await dragonBuyAndBurn.lastCallTs() + await dragonBuyAndBurn.interval()
    if (await time.latest() < nextInterval) {
      await time.increaseTo(nextInterval)
    }
    tx = await dragonBuyAndBurn.connect(user).buyAndBurnDragonX()
    receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'BoughtAndBurned') as EventLog
    const dragonBurned2 = event.args.dragon as bigint
    expect(await dragonBuyAndBurn.totalWethUsedForBuyAndBurns())
      .to.be.equal(expectedWethForBuyAndBurn + expectedWethForBuyAndBurn2)
    expect(await dragonBuyAndBurn.totalDragonBurned()).to.be.equal(dragonBurned + dragonBurned2)
  })
  it('Should have a function to get the total WETH for Buy And Burn DragonX (below cap)', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonBuyAndBurn, dragonX } = fixture
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)
    await ensureEthClaimable(fixture)

    await dragonX.claim()
    const balance = await weth.balanceOf(await dragonBuyAndBurn.getAddress())
    const cap = await dragonBuyAndBurn.capPerSwap()
    expect(balance).to.be.lessThan(cap)

    const incentiveFee = (balance * Constants.INCENTIVE_FEE) / Constants.BASIS
    expect(balance).to.be.equal(await dragonBuyAndBurn.totalWethForBuyAndBurn())
    expect(balance).to.be.equal(await dragonBuyAndBurn.wethForNextBuyAndBurn())
    expect(incentiveFee).to.be.equal(await dragonBuyAndBurn.incentiveFeeForRunningBuyAndBurnDragonX())
  })
  it('Should update state if collecting fees from liquidity pool', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { user, dragonBuyAndBurn, dragonX, titanX } = fixture

    // prepare claim
    await ensureEthClaimable(fixture)

    // claim
    await dragonX.connect(user).claim()

    // buy and burn DragonX (fees for liquidity pool)
    await dragonBuyAndBurn.buyAndBurnDragonX()

    // prepare
    const dragonSupplyBefore = await dragonX.totalSupply()
    const titanBalanceBefore = await titanX.balanceOf(await dragonX.getAddress())
    const vaultBefore = await dragonX.vault()

    // Buy and burn DragonX
    const tx = await dragonBuyAndBurn.connect(user).collectFees()
    const receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    const event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'CollectedFees') as EventLog
    expect(event.args.caller).to.be.equal(user.address)
    expect(await dragonX.totalSupply()).to.be.equal(dragonSupplyBefore - event.args.dragon)
    expect(await titanX.balanceOf(await dragonX.getAddress())).to.be.equal(titanBalanceBefore + event.args.titan)
    expect(await dragonX.vault()).to.be.equal(vaultBefore + event.args.titan)
  })
  if (process.env.LIQUIDITY_POOL_TEST) {
    it('Buy bigger chunks of liquidity', async () => {
      const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
      const { dragonX, titanBuy, dragonBuyAndBurn, user, others, swap, titanX } = fixture

      // Let other uses mint a lot of DragonX to kick off mechanisms
      for (let idx = 0; idx < 5; idx++) {
        const otherUser = others[idx]
        await swap.connect(otherUser).swapETHForTitanX({ value: ethers.parseEther('10') })
        const balance = await titanX.balanceOf(otherUser.address)
        await titanX.connect(otherUser).approve(await dragonX.getAddress(), balance)
        await dragonX.connect(otherUser).mint(balance)
      }

      const bar = new progress.SingleBar({}, progress.Presets.shades_classic)
      const initialSupply = await dragonX.totalSupply()

      const numIterations = 10
      console.log(`Do ${numIterations} iterations of DragonX buy and burn`)
      bar.start(numIterations, 0)

      for (let i = 1; i <= numIterations; i++) {
        // make sure ETH is claimable
        await ensureEthClaimable(fixture)

        // claim ETH
        await dragonX.connect(user).claim()

        // Buy TitanX
        while (await titanBuy.wethForNextBuy() > 0n) {
          if (await time.latest() <= await titanBuy.lastCallTs() + await titanBuy.interval()) {
            await time.increaseTo(await titanBuy.lastCallTs() + await titanBuy.interval() + 1n)
          }
          await titanBuy.connect(user).buyTitanX()
        }

        // Buy and Burn DragonX
        // Buy TitanX
        while (await dragonBuyAndBurn.wethForNextBuyAndBurn() > 0n) {
          if (await time.latest() <= await dragonBuyAndBurn.lastCallTs() + await dragonBuyAndBurn.interval()) {
            await time.increaseTo(await dragonBuyAndBurn.lastCallTs() + await dragonBuyAndBurn.interval() + 1n)
          }
          await dragonBuyAndBurn.connect(user).buyAndBurnDragonX()
        }

        // Ensure cooldown is done
        if (await time.latest() < await dragonX.nextStakeTs()) {
          await time.increaseTo(await dragonX.nextStakeTs())
        }

        // open a stake
        await dragonX.connect(user).stake()
        bar.update(i)
      }
      bar.stop()

      const finalSupply = await dragonX.totalSupply()

      // Calculate the burned amount and the percentage
      const burnedAmount = initialSupply - finalSupply
      const burnedRatio = burnedAmount * BigInt(10000) / initialSupply
      const burnedInPercent = Number(burnedRatio) / 100

      expect(burnedAmount).to.be.equal(await dragonBuyAndBurn.totalDragonBurned())
      console.log(`DragonX initial supply: 
      ${ethers.formatEther(initialSupply)}`)
      console.log(`DragonX final supply: 
      ${ethers.formatEther(finalSupply)}`)
      console.log(`DragonX final supply: 
        ${ethers.formatEther(await dragonBuyAndBurn.totalDragonBurned())} 
        (${burnedInPercent}% of total supply)`)
      console.log(`Total ETH used for Buy And Burn: 
        ${ethers.formatEther(await dragonBuyAndBurn.totalWethUsedForBuyAndBurns())}`)
      console.log(`Total ETH claimed: 
        ${ethers.formatEther(await dragonX.totalEthClaimed())}`)
    })
  }
})
