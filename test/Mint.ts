import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXFixtureNoInitialLiquidityMinted } from './Fixture'
import * as Constants from './Constants'

describe('Mint', () => {
  it('Should revert if minting phase has not started', async () => {
    const { dragonX, titanX, swap, user } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted
    expect(await titanX.balanceOf(user.address)).to.be.greaterThan(0n)

    // Users attempts to mint, should revert
    expect(await time.latest()).to.be.lessThan(await dragonX.mintPhaseBegin())
    await expect(dragonX.connect(user).mint(await titanX.balanceOf(user.address)))
      .to.be.revertedWithCustomError(dragonX, 'MintingNotYetActive')
  })
  it('Should revert if minting phase has ended', async () => {
    const { dragonX, titanX, swap, user } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted
    expect(await titanX.balanceOf(user.address)).to.be.greaterThan(0n)

    // Users attempts to mint, should revert
    await time.increaseTo(
      await dragonX.mintPhaseEnd() + 1n,
    )
    await expect(dragonX.connect(user).mint(await titanX.balanceOf(user.address)))
      .to.be.revertedWithCustomError(dragonX, 'MintingPeriodOver')
  })
  it('Should revert if user did not allow DragonX to transfer TitanX tokens', async () => {
    const { dragonX, titanX, swap, user } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted
    expect(await titanX.balanceOf(user.address)).to.be.greaterThan(0n)

    // Users attempts to mint, should revert
    await time.increaseTo(
      await dragonX.mintPhaseBegin(),
    )
    await expect(dragonX.connect(user).mint(await titanX.balanceOf(user.address)))
      .to.be.revertedWithCustomError(dragonX, 'InsufficientTitanXAllowance')
  })
  it('Should revert if user has not enough TitanX tokens', async () => {
    const { dragonX, titanX, swap, user } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted
    expect(await titanX.balanceOf(user.address)).to.be.greaterThan(0n)

    // Users attempts to mint, should revert
    await time.increaseTo(
      await dragonX.mintPhaseBegin(),
    )
    await titanX.connect(user).approve(await dragonX.getAddress(), await titanX.balanceOf(user.address) + 1n)
    await expect(dragonX.connect(user).mint(await titanX.balanceOf(user.address) + 1n))
      .to.be.revertedWithCustomError(dragonX, 'InsufficientTitanXBalance')
  })
  it('Should mint the correct amount of DragonX tokens, 1:1 in the beginning', async () => {
    const { dragonX, titanX, swap, user, initialLiquidity } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted

    const titanXbought = await titanX.balanceOf(user.address)
    expect(titanXbought).to.be.greaterThan(0n)

    const expectedGenesisShare = await titanX.balanceOf(user.address) * Constants.GENESIS_SHARE / Constants.BASIS
    const expectedDragonXtotalSupply = titanXbought + expectedGenesisShare + initialLiquidity
    const dragonXexpectedTitanXbalance = titanXbought
    const userExpectedDragonXbalance = titanXbought
    const dragonXexpectedTitanXvault = titanXbought - expectedGenesisShare

    // Users mints
    await time.increaseTo(
      await dragonX.mintPhaseBegin(),
    )
    await titanX.connect(user).approve(await dragonX.getAddress(), await titanX.balanceOf(user.address))
    await expect(dragonX.connect(user).mint(await titanX.balanceOf(user.address)))
      .to.not.be.reverted

    // Balance checks
    expect(await titanX.balanceOf(user.address)).to.be.equal(0n)
    expect(await dragonX.balanceOf(user.address)).to.be.equal(userExpectedDragonXbalance)
    expect(await titanX.balanceOf(await dragonX.getAddress())).to.be.equal(dragonXexpectedTitanXbalance)
    expect(await dragonX.balanceOf(await dragonX.getAddress())).to.be.equal(expectedGenesisShare)
    expect(await dragonX.totalSupply()).to.be.equal(expectedDragonXtotalSupply)
    expect(await dragonX.vault()).to.be.equal(dragonXexpectedTitanXvault)
  })
  it('Should allow to mint for 12 weeks with reducing the ratio by 5% after week 2', async () => {
    const { swap, dragonX, titanX, user, genesis } = await loadFixture(deployDragonXFixture)

    // Users swaps ETH for TitanX on UniSwap
    await expect(swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })).to.not.be.reverted

    const balanceBefore = await titanX.balanceOf(user.address)
    expect(balanceBefore).to.be.greaterThan(0n)
    expect(await dragonX.balanceOf(user.address)).to.be.equal(0n)

    // Allow DragonX to spend TitanX
    await titanX.connect(user).approve(await dragonX.getAddress(), balanceBefore)

    // Activate
    const mintPhaseBegin = await dragonX.mintPhaseBegin()
    await time.increaseTo(mintPhaseBegin)

    // Mint in week one
    const expectedDragonBalanceWeekOne = 0n + ethers.parseEther('1')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekOne)

    // Mint in week two
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekTwo = expectedDragonBalanceWeekOne + ethers.parseEther('1')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekTwo)

    // Mint in week three
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekThree = expectedDragonBalanceWeekTwo + ethers.parseEther('0.95')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekThree)

    // Mint in week four
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekFour = expectedDragonBalanceWeekThree + ethers.parseEther('0.9')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekFour)

    // Mint in week five
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekFive = expectedDragonBalanceWeekFour + ethers.parseEther('0.85')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekFive)

    // Mint in week six
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekSix = expectedDragonBalanceWeekFive + ethers.parseEther('0.8')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekSix)

    // Mint in week seven
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekSeven = expectedDragonBalanceWeekSix + ethers.parseEther('0.75')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekSeven)

    // Mint in week eight
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekEight = expectedDragonBalanceWeekSeven + ethers.parseEther('0.7')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekEight)

    // Mint in week nine
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekNine = expectedDragonBalanceWeekEight + ethers.parseEther('0.65')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekNine)

    // Mint in week ten
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekTen = expectedDragonBalanceWeekNine + ethers.parseEther('0.6')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekTen)

    // Mint in week eleven
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekEleven = expectedDragonBalanceWeekTen + ethers.parseEther('0.55')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekEleven)

    // Mint in week twelve
    await time.increase(Constants.SECONDS_PER_WEEK)
    const expectedDragonBalanceWeekTwelve = expectedDragonBalanceWeekEleven + ethers.parseEther('0.5')
    await expect(dragonX.connect(user).mint(ethers.parseEther('1'))).to.not.be.reverted
    expect(await dragonX.balanceOf(user.address)).to.be.equal(expectedDragonBalanceWeekTwelve)

    const totalDragonMinted = expectedDragonBalanceWeekTwelve

    const totalTitanUsed = ethers.parseEther('12')
    const totalTitanGenesisShare = (totalTitanUsed * 800n) / Constants.BASIS
    const totalDragonGenesisShare = (totalDragonMinted * 800n) / Constants.BASIS

    // Ensure DragonX state
    // Check balances
    expect(await dragonX.balanceOf(user.address)).to.be.equal(totalDragonMinted)
    expect(await dragonX.vault()).to.be.equal(totalTitanUsed - totalTitanGenesisShare)

    // Ensure genesis vault has correct amoun
    expect(await titanX.balanceOf(genesis.address)).to.be.equal(0n)
    expect(await dragonX.balanceOf(genesis.address)).to.be.equal(0n)
    await expect(dragonX.connect(genesis).claimGenesis(await dragonX.getAddress())).not.to.be.reverted
    await expect(dragonX.connect(genesis).claimGenesis(await titanX.getAddress())).not.to.be.reverted
    expect(await titanX.balanceOf(genesis.address)).to.be.equal(totalTitanGenesisShare)
    expect(await dragonX.balanceOf(genesis.address)).to.be.equal(totalDragonGenesisShare)
  })
  describe('initial liquditiy', () => {
    it('Should revert if initial liquidity has not been minted', async () => {
      const { dragonX } = await loadFixture(deployDragonXFixtureNoInitialLiquidityMinted)
      await expect(dragonX.mint(0n)).to.be.revertedWithCustomError(dragonX, 'LiquidityNotMintedYet')
    })
    it('Should only allow DragonBuyAndBurn to mint initial liquidity', async () => {
      const { dragonX, user } = await loadFixture(deployDragonXFixtureNoInitialLiquidityMinted)
      await expect(dragonX.connect(user).mintInitialLiquidity(0n)).to.be.revertedWith('not authorized')
    })
    it('Should revert if genesis / DragonBuyAndBurn tries to mint initial liquidity a second time', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).createInitialLiquidity(0n)).to.be.revertedWith('already minted')
    })
    it('Should revert when trying to mint inital Liquidity without setting DragonX address on DragonBuyAndBurn', async () => {
      const { genesis } = await loadFixture(deployDragonXFixture)
      const fDragonBuyAndBurn = await ethers.getContractFactory('DragonBuyAndBurn')
      const dragonBuyAndBurn = await fDragonBuyAndBurn.deploy()

      await expect(dragonBuyAndBurn.connect(genesis).createInitialLiquidity(0n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'InvalidDragonAddress')
    })
    it('Should revert when TitanX allowance is too low', async () => {
      const { genesis, dragonBuyAndBurn, titanX } = await loadFixture(deployDragonXFixtureNoInitialLiquidityMinted)
      await titanX.connect(genesis).approve(await dragonBuyAndBurn.getAddress(), 0n)
      await expect(dragonBuyAndBurn.connect(genesis).createInitialLiquidity(1000n))
        .to.be.revertedWith('allowance too low')
    })
    it('Should revert when TitanX balance is too low', async () => {
      const { genesis, dragonBuyAndBurn, titanX, initialLiquidity }
        = await loadFixture(deployDragonXFixtureNoInitialLiquidityMinted)
      await titanX.connect(genesis).transfer(await titanX.getAddress(), initialLiquidity)
      await expect(dragonBuyAndBurn.connect(genesis).createInitialLiquidity(1000n))
        .to.be.revertedWith('balance too low')
    })
    it('Should revert if a user tries to mint initial liquidity', async () => {
      const { user, dragonBuyAndBurn }
        = await loadFixture(deployDragonXFixtureNoInitialLiquidityMinted)
      await expect(dragonBuyAndBurn.connect(user).createInitialLiquidity(0n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
    })
    it('Initial DragonX / TitanX price should be 1:1', async () => {
      const { swap, dragonX, titanX, genesis } = await loadFixture(deployDragonXFixture)

      // Market Buy some TitanX using ETH
      await swap.connect(genesis).swapETHForTitanX({ value: ethers.parseEther('1') })

      // Market Buy exactly one DragonX using TitanX
      const balanceBefore = await dragonX.balanceOf(genesis.address)
      await titanX.connect(genesis).approve(await swap.getAddress(), ethers.parseEther('1'))
      await swap.connect(genesis).swapTitanToDragon(ethers.parseEther('1'), await dragonX.getAddress())
      const balanceAfter = await dragonX.balanceOf(genesis.address)

      const amountOut = balanceBefore - balanceAfter
      const formattedAmountOut = Number(ethers.formatEther(amountOut))

      // We should now have approximately one DragonX
      expect(formattedAmountOut).to.be.approximately(formattedAmountOut, 0.000001)
    })
  })
})
