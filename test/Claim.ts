import {
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { EventLog } from 'ethers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXUserHasMintedFixture, ensureEthClaimable } from './Fixture'
import * as Constants from './Constants'

describe('Claim', () => {
  it('Should revert if Claim is called by a bot', async () => {
    const { dragonX } = await loadFixture(deployDragonXFixture)
    const TriggerBot = await ethers.getContractFactory('TriggerBot')
    const triggerBot = await TriggerBot.deploy()

    await expect(triggerBot.triggerClaim(await dragonX.getAddress()))
      .to.be.revertedWithCustomError(dragonX, 'InvalidCaller')
  })
  it('Should update states correctly and emit an event', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { user, titanBuy, dragonX, dragonBuyAndBurn, titanX } = fixture
    const weth = await ethers.getContractAt('ERC20', Constants.WETH_ADDRESS)
    const titanBuyAddress = await titanBuy.getAddress()
    const dragonXAddress = await dragonX.getAddress()
    const dragonBuyAndBurnAddress = await dragonBuyAndBurn.getAddress()

    // prepare claim
    await ensureEthClaimable(fixture)

    // Make sure to get up-to-date data
    await titanX.triggerPayouts()
    const userEthBalanceBefore = await ethers.provider.getBalance(user.address)
    const totalEthClaimable = await dragonX.totalEthClaimable()
    const genesisShare = (totalEthClaimable * Constants.GENESIS_SHARE) / Constants.BASIS
    const dragonBuyAndBurnShare = (totalEthClaimable * Constants.BUY_AND_BURN_SHARE) / Constants.BASIS
    const incentiveFee = (totalEthClaimable * Constants.INCENTIVE_FEE) / Constants.BASIS
    const titanBuyShare = totalEthClaimable - genesisShare - dragonBuyAndBurnShare - incentiveFee

    // Make sure initial test conditions are met
    expect(await weth.balanceOf(titanBuyAddress)).to.be.equal(0n)
    expect(await ethers.provider.getBalance(dragonXAddress)).to.be.equal(0n)

    // claim
    const tx = await dragonX.connect(user).claim()
    const receipt = await tx.wait()
    expect(receipt).not.to.be.null

    // Ensure that an event was emitted
    if (!receipt) return
    const event = receipt.logs.find((log) => log instanceof EventLog && log.fragment.name === 'Claimed') as EventLog
    const totalEthClaimed = event.args.totalClaimed as bigint
    const incentiveFeePaid = event.args.incentiveFee as bigint
    const genesisShareAccounted = event.args.genesis as bigint
    const dragonBuyAndBurnSend = event.args.dragonBuyAndBurn as bigint
    const titanBuySend = event.args.titanBuy as bigint
    expect(totalEthClaimable).to.be.equal(totalEthClaimed)
    expect(incentiveFee).to.be.equal(incentiveFeePaid)
    expect(genesisShare).to.be.equal(genesisShareAccounted)
    expect(dragonBuyAndBurnShare).to.be.equal(dragonBuyAndBurnSend)
    expect(titanBuyShare).to.be.equal(titanBuySend)

    // Consider TX fee
    if (!receipt) return
    const totalFee = receipt.gasUsed * receipt.gasPrice
    const userExpectedEthBalance = userEthBalanceBefore - totalFee + incentiveFee

    // Ensure balanaces are correct
    expect(await ethers.provider.getBalance(user.address)).to.be.greaterThanOrEqual(userExpectedEthBalance)
    expect(await weth.balanceOf(dragonXAddress)).to.be.equal(0n)
    expect(await ethers.provider.getBalance(dragonXAddress)).to.be.equal(genesisShare)
    expect(await weth.balanceOf(titanBuyAddress)).to.be.equal(titanBuyShare)
    expect(await weth.balanceOf(dragonBuyAndBurnAddress)).to.be.equal(dragonBuyAndBurnShare)
    expect(await ethers.provider.getBalance(await dragonX.activeDragonStakeContract())).to.be.equal(0n)
  })
  it('Should revert when fallback function is triggered', async () => {
    const { genesis, dragonX } = await loadFixture(deployDragonXFixture)
    await expect(genesis.sendTransaction({
      to: await dragonX.getAddress(), data: '0x1234',
    })).to.be.revertedWith('Fallback triggered')
  })
  it('Should revert if a user sends ETH', async () => {
    const { user, dragonX } = await loadFixture(deployDragonXFixture)
    await expect(user.sendTransaction({
      to: await dragonX.getAddress(), value: ethers.parseEther('1'),
    })).to.be.revertedWith('Sender not authorized')
  })
  it('Should calculate incentive fee for frontend', async () => {
    const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
    const { dragonX } = fixture
    await ensureEthClaimable(fixture)

    const ethClaimable = await dragonX.totalEthClaimable()
    const incentiveFee = (ethClaimable * Constants.INCENTIVE_FEE) / Constants.BASIS

    expect(incentiveFee).to.be.equal(await dragonX.incentiveFeeForClaim())
  })
  it('Should revert if no ETH is claimable', async () => {
    const { dragonX } = await loadFixture(deployDragonXUserHasMintedFixture)
    await expect(dragonX.claim()).to.be.revertedWithCustomError(dragonX, 'NoEthClaimable')
  })
})
