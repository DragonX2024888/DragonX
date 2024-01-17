import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { EventLog } from 'ethers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXUserHasMintedFixture, ensureEthClaimable } from './Fixture'
import * as Constants from './Constants'
import { quoteTitanForEth } from './Quote'

describe('TitanBuy', () => {
  it('Should calculate a proper amount for slippage protection', async () => {
    const { titanBuy } = await loadFixture(deployDragonXFixture)
    // The initial price is set at 1:1, the initial slippage is 5%
    // Hence, calculate an exceptable amount for 1 WETH as Input
    const expectedTitanQuote = await quoteTitanForEth(ethers.parseEther('1'))
    const titanQuote = await titanBuy.getTitanQuoteForEth(ethers.parseEther('1'))
    expect(titanQuote).to.be.equal(expectedTitanQuote)
    const adjustedTitanAmount = (titanQuote * 95n) / 100n

    expect(await titanBuy.calculateMinimumTitanAmount(ethers.parseEther('1'))).to.be.equal(adjustedTitanAmount)
  })
  it('Should revert if DragonX address is not set', async () => {
    const TitanBuy = await ethers.getContractFactory('TitanBuy')
    const titanBuy = await TitanBuy.deploy()

    await expect(titanBuy.buyTitanX()).to.be.revertedWithCustomError(titanBuy, 'InvalidDragonAddress')
  })
  it('Should revert if TitanBuy is called by a bot', async () => {
    const { titanBuy } = await loadFixture(deployDragonXFixture)
    const TriggerBot = await ethers.getContractFactory('TriggerBot')
    const triggerBot = await TriggerBot.deploy()

    await expect(triggerBot.triggerBuyTitan(await titanBuy.getAddress())).to.be.revertedWithCustomError(titanBuy, 'InvalidCaller')
  })
  it('Should revert if there is no ETH to buy', async () => {
    const { titanBuy, user } = await loadFixture(deployDragonXFixture)

    await expect(titanBuy.connect(user).buyTitanX()).to.be.revertedWithCustomError(titanBuy, 'NoWethToBuyTitan')
  })
  it('Should revert when triggered while cooldown is active', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonX, titanBuy } = fixture

    // Trigger claim (this will distribute to TitanBuy)
    await ensureEthClaimable(fixture)
    await dragonX.claim()

    // Buy TitanX
    await expect(titanBuy.buyTitanX()).to.not.be.reverted

    // Call again
    await expect(titanBuy.buyTitanX()).to.be.revertedWithCustomError(titanBuy, 'CooldownPeriodActive')
  })
  it('Should cap the maximum amount of ETH per DragonX buy and burn', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonX, titanBuy, swap, user, titanX } = fixture

    // Let user buy some decent amount of TitanX
    await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('100') })

    // User mints DragonX
    const balance = await titanX.balanceOf(user.address)
    await titanX.connect(user).approve(await dragonX.getAddress(), balance)
    await dragonX.connect(user).mint(balance)

    // Trigger claim (this will distribute to TitanBuy)
    const titanBuyAddress = await titanBuy.getAddress()
    const capPerSwap = await titanBuy.capPerSwap()
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)
    while (await weth.balanceOf(titanBuyAddress) <= capPerSwap) {
      await ensureEthClaimable(fixture)
      await dragonX.claim()
    }

    const balanceBefore = await weth.balanceOf(titanBuyAddress)
    const incentiveFee = (capPerSwap * Constants.INCENTIVE_FEE) / Constants.BASIS

    // Buy TitanX
    expect(balanceBefore).to.be.equal(await titanBuy.totalWethForBuy())
    expect(capPerSwap).to.be.equal(await titanBuy.wethForNextBuy())
    expect(incentiveFee).to.be.equal(await titanBuy.incentiveFeeForRunningBuyTitanX())
    await expect(titanBuy.buyTitanX()).to.not.be.reverted
    expect(await weth.balanceOf(titanBuyAddress)).to.be.equal(balanceBefore - capPerSwap)
  })
  it('Should revert when fallback function is triggered', async () => {
    const { genesis, titanBuy } = await loadFixture(deployDragonXFixture)
    await expect(genesis.sendTransaction({
      to: await titanBuy.getAddress(), data: '0x1234',
    })).to.be.revertedWith('Fallback triggered')
  })
  it('Should updates states correctly and emit an event', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { user, titanBuy, dragonX, titanX } = fixture
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)

    // prepare claim
    await ensureEthClaimable(fixture)

    // claim
    await dragonX.connect(user).claim()

    // Prepare
    const vaultBefore = await dragonX.vault()
    let balanceBefore = await weth.balanceOf(await titanBuy.getAddress())
    let amountIn = balanceBefore
    if (amountIn > await titanBuy.capPerSwap()) {
      amountIn = await titanBuy.capPerSwap()
    }
    const titanBalanceBefore = await titanX.balanceOf(await dragonX.getAddress())
    let incentiveFee = (amountIn * Constants.INCENTIVE_FEE) / Constants.BASIS
    expect(await titanBuy.totalWethUsedForBuys()).to.be.equal(0n)
    expect(await titanBuy.totalTitanBought()).to.be.equal(0n)
    const userEthBalanceBefore = await ethers.provider.getBalance(user.address)
    const expectedWethForBuy = amountIn - incentiveFee

    // Buy TitanX
    let tx = await titanBuy.connect(user).buyTitanX()
    let receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    let event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'TitanBought') as EventLog
    expect(event.args.weth).to.be.equal(expectedWethForBuy)
    expect(await weth.balanceOf(await titanBuy.getAddress()))
      .to.be.equal(balanceBefore - expectedWethForBuy - incentiveFee)
    expect(event.args.caller).to.be.equal(user.address)

    // State updates of other contracts
    const titanBought = event.args.titan as bigint
    expect(await titanX.balanceOf(await dragonX.getAddress())).to.be.equal(titanBalanceBefore + titanBought)
    expect(await dragonX.vault()).to.be.equal(vaultBefore + titanBought)

    // State variables
    expect(await titanBuy.totalWethUsedForBuys()).to.be.equal(expectedWethForBuy)
    expect(await titanBuy.totalTitanBought()).to.be.equal(titanBought)

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
    balanceBefore = await weth.balanceOf(await titanBuy.getAddress())
    amountIn = balanceBefore
    if (amountIn > await titanBuy.capPerSwap()) {
      amountIn = await titanBuy.capPerSwap()
    }
    incentiveFee = (amountIn * Constants.INCENTIVE_FEE) / Constants.BASIS
    const expectedWethForBuy2 = amountIn - incentiveFee

    const nextInterval = await titanBuy.lastCallTs() + await titanBuy.interval()
    if (await time.latest() < nextInterval) {
      await time.increaseTo(nextInterval)
    }
    tx = await titanBuy.connect(user).buyTitanX()
    receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'TitanBought') as EventLog
    expect(receipt).not.to.be.null
    const titanBought2 = event.args.titan as bigint
    expect(await titanBuy.totalWethUsedForBuys()).to.be.equal(expectedWethForBuy + expectedWethForBuy2)
    expect(await titanBuy.totalTitanBought()).to.be.equal(titanBought + titanBought2)
  })
  it('Should have a function to get the total WETH for Buy TitanX (below cap)', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { titanBuy, dragonX, genesis } = fixture
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)
    await ensureEthClaimable(fixture)

    await dragonX.claim()
    const balance = await weth.balanceOf(await titanBuy.getAddress())
    await titanBuy.connect(genesis).setCapPerSwap(balance + 1n)
    const cap = await titanBuy.capPerSwap()
    expect(balance).to.be.lessThan(cap)

    const incentiveFee = (balance * Constants.INCENTIVE_FEE) / Constants.BASIS
    expect(balance).to.be.equal(await titanBuy.totalWethForBuy())
    expect(balance).to.be.equal(await titanBuy.wethForNextBuy())
    expect(incentiveFee).to.be.equal(await titanBuy.incentiveFeeForRunningBuyTitanX())
  })
})
