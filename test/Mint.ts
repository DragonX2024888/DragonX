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
  it('Should mint the correct amount of DragonX tokens', async () => {
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
