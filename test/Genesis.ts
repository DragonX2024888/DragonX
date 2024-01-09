import {
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { deployDragonXFixture, deployDragonXUserHasMintedFixture, ensureEthClaimable } from './Fixture'
import * as Constants from './Constants'

describe('Genesis', () => {
  describe('Ownable', () => {
    it('Genesis address should be owner of DragonX', async () => {
      const { dragonX, genesis } = await loadFixture(deployDragonXFixture)
      expect(await dragonX.owner()).to.be.equal(genesis.address)
    })
    it('DragonX should be owner of DragonStake', async () => {
      const { dragonX } = await loadFixture(deployDragonXFixture)
      const currentlyActiveDragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())
      expect(await currentlyActiveDragonStake.owner()).to.be.equal(await dragonX.getAddress())
    })
    it('Genesis address should be owner of DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      expect(await dragonBuyAndBurn.owner()).to.be.equal(genesis.address)
    })
    it('Genesis address should be owner of TitanBuy', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      expect(await titanBuy.owner()).to.be.equal(genesis.address)
    })
  })
  describe('Manage Addresses', () => {
    it('Only genesis address should be able to set DragonX address on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, dragonX, user } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setDragonContractAddress(
        await dragonX.getAddress(),
      )).to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
    })
    it('Should revert when setting DragonX address on DragonBuyAndBurn to zero', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setDragonContractAddress(
        Constants.ADDRESS_ZERO,
      )).to.be.revertedWithCustomError(dragonBuyAndBurn, 'InvalidDragonAddress')
    })
    it('Only genesis address should be able to set DragonX address on TitanBuy', async () => {
      const { titanBuy, dragonX, user } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(user).setDragonContractAddress(
        await dragonX.getAddress(),
      )).to.be.revertedWithCustomError(titanBuy, 'OwnableUnauthorizedAccount')
    })
    it('Should revert when setting DragonX address on TitanBuy to zero', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setDragonContractAddress(
        Constants.ADDRESS_ZERO,
      )).to.be.revertedWithCustomError(titanBuy, 'InvalidDragonAddress')
    })
    it('Only genesis address should be able to set DragonBuyAndBurn address on DragonX', async () => {
      const { dragonBuyAndBurn, dragonX, user } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(user).setDragonBuyAndBurnAddress(
        await dragonBuyAndBurn.getAddress(),
      )).to.be.revertedWithCustomError(dragonX, 'OwnableUnauthorizedAccount')
    })
    it('Should revert when setting DragonX address on DragonBuyAndBurn to zero', async () => {
      const { dragonX, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(genesis).setDragonBuyAndBurnAddress(
        Constants.ADDRESS_ZERO,
      )).to.be.revertedWithCustomError(dragonX, 'InvalidAddress')
    })
    it('Should not revert when setting DragonX address on DragonBuyAndBurn to a valid address', async () => {
      const { dragonX, dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(genesis).setDragonBuyAndBurnAddress(
        await dragonBuyAndBurn.getAddress(),
      )).to.not.be.reverted
    })
    it('Only genesis address should be able to set TitanBuy address on DragonX', async () => {
      const { titanBuy, dragonX, user } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(user).setTitanBuyAddress(
        await titanBuy.getAddress(),
      )).to.be.revertedWithCustomError(dragonX, 'OwnableUnauthorizedAccount')
    })
    it('Should revert when setting DragonX address on TitanBuy to zero', async () => {
      const { dragonX, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(genesis).setTitanBuyAddress(
        Constants.ADDRESS_ZERO,
      )).to.be.revertedWithCustomError(dragonX, 'InvalidAddress')
    })
    it('Should not revert when setting DragonX address on TitanBuy to a valid address', async () => {
      const { dragonX, titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(genesis).setTitanBuyAddress(
        await titanBuy.getAddress(),
      )).to.not.be.reverted
    })
  })
  describe('Manage TitanBuy Settings', () => {
    it('Only genesis address should be able to set capPerSwap on TitanBuy', async () => {
      const { titanBuy, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(user).setCapPerSwap(ethers.parseEther('1')))
        .to.be.revertedWithCustomError(titanBuy, 'OwnableUnauthorizedAccount')
      await expect(titanBuy.connect(genesis).setCapPerSwap(ethers.parseEther('1')))
        .to.not.be.reverted
    })
    it('Only genesis address should be able to set BuyAndBurnInterval on TitanBuy', async () => {
      const { titanBuy, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(user).setBuyAndBurnInterval(120n))
        .to.be.revertedWithCustomError(titanBuy, 'OwnableUnauthorizedAccount')
      await expect(titanBuy.connect(genesis).setBuyAndBurnInterval(120n))
        .to.not.be.reverted
    })
    it('Only genesis address should be able to set slippage on TitanBuy', async () => {
      const { titanBuy, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(user).setSlippage(10n))
        .to.be.revertedWithCustomError(titanBuy, 'OwnableUnauthorizedAccount')
      await expect(titanBuy.connect(genesis).setSlippage(10n))
        .to.not.be.reverted
    })
    it('Should revert when trying to set a slippage below 5% on TitanBuy', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setSlippage(4n))
        .to.be.revertedWith('5-15% only')
    })
    it('Should revert when trying to set a above 15% on TitanBuy', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setSlippage(16n))
        .to.be.revertedWith('5-15% only')
    })

    it('Should revert when trying to set an interval below 1 min on TitanBuy', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setBuyAndBurnInterval(59n))
        .to.be.revertedWith('1m-12h only')
    })
    it('Should revert when trying to set a above 12h on TitanBuy', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setBuyAndBurnInterval(43201n))
        .to.be.revertedWith('1m-12h only')
    })
    it('Only genesis address should be able to set TWA for TitanX price', async () => {
      const { titanBuy, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(user).setTitanPriceTwa(10n))
        .to.be.revertedWithCustomError(titanBuy, 'OwnableUnauthorizedAccount')
      await expect(titanBuy.connect(genesis).setTitanPriceTwa(10n))
        .to.not.be.reverted
    })
    it('Should revert when trying to set TWA below 5 min for TitanX price', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setTitanPriceTwa(4n))
        .to.be.revertedWith('5m-1h only')
    })
    it('Should revert when trying to set TWA above 60 min for TitanX price', async () => {
      const { titanBuy, genesis } = await loadFixture(deployDragonXFixture)
      await expect(titanBuy.connect(genesis).setTitanPriceTwa(61n))
        .to.be.revertedWith('5m-1h only')
    })
  })
  describe('Manage DragonBuyAndBurn Settings', () => {
    it('Only genesis address should be able to set capPerSwap on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setCapPerSwap(ethers.parseEther('1')))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
      await expect(dragonBuyAndBurn.connect(genesis).setCapPerSwap(ethers.parseEther('1')))
        .to.not.be.reverted
    })
    it('Only genesis address should be able to set BuyAndBurnInterval on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setBuyAndBurnInterval(120n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
      await expect(dragonBuyAndBurn.connect(genesis).setBuyAndBurnInterval(120n))
        .to.not.be.reverted
    })
    it('Only genesis address should be able to set slippage on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setSlippage(10n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
      await expect(dragonBuyAndBurn.connect(genesis).setSlippage(10n))
        .to.not.be.reverted
    })
    it('Should revert when trying to set a slippage below 5% on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setSlippage(4n))
        .to.be.revertedWith('5-15% only')
    })
    it('Should revert when trying to set a above 15% on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setSlippage(16n))
        .to.be.revertedWith('5-15% only')
    })

    it('Should revert when trying to set an interval below 1 min on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setBuyAndBurnInterval(59n))
        .to.be.revertedWith('1m-12h only')
    })
    it('Should revert when trying to set a above 12h on DragonBuyAndBurn', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setBuyAndBurnInterval(43201n))
        .to.be.revertedWith('1m-12h only')
    })
    it('Only genesis address should be able to set TWA for DragonX price', async () => {
      const { dragonBuyAndBurn, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setDragonPriceTwa(10n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
      await expect(dragonBuyAndBurn.connect(genesis).setDragonPriceTwa(10n))
        .to.not.be.reverted
    })
    it('Should revert when trying to set TWA below 5 min for DragonX price', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setDragonPriceTwa(4n))
        .to.be.revertedWith('5m-1h only')
    })
    it('Should revert when trying to set TWA above 60 min for DragonX price', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setDragonPriceTwa(61n))
        .to.be.revertedWith('5m-1h only')
    })
    it('Only genesis address should be able to set TWA for TitanX price', async () => {
      const { dragonBuyAndBurn, user, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(user).setDragonPriceTwa(10n))
        .to.be.revertedWithCustomError(dragonBuyAndBurn, 'OwnableUnauthorizedAccount')
      await expect(dragonBuyAndBurn.connect(genesis).setTitanPriceTwa(10n))
        .to.not.be.reverted
    })
    it('Should revert when trying to set TWA below 5 min for TitanX price', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setTitanPriceTwa(4n))
        .to.be.revertedWith('5m-1h only')
    })
    it('Should revert when trying to set TWA above 60 min for TitanX price', async () => {
      const { dragonBuyAndBurn, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonBuyAndBurn.connect(genesis).setTitanPriceTwa(61n))
        .to.be.revertedWith('5m-1h only')
    })
  })
  describe('Claim Genesis Allocations', () => {
    it('Should revert if called by user', async () => {
      const { dragonX, user } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(user).claimGenesis(Constants.ADDRESS_ZERO))
        .to.be.revertedWithCustomError(dragonX, 'OwnableUnauthorizedAccount')
    })
    it('Should revert if no balance to claim', async () => {
      const { dragonX, genesis } = await loadFixture(deployDragonXFixture)
      await expect(dragonX.connect(genesis).claimGenesis(Constants.ADDRESS_ZERO))
        .to.be.revertedWith('no balance')
    })
    it('Should be able to claim genesis allocations from mint and runtime allocations from claim', async () => {
      const fixture = await loadFixture(deployDragonXUserHasMintedFixture)
      const { dragonX, titanX, genesis, user } = fixture
      const userBalanace = await dragonX.balanceOf(user.address)
      const expectedDragonX = (userBalanace * Constants.GENESIS_SHARE) / Constants.BASIS
      const expectedTitanX = (userBalanace * Constants.GENESIS_SHARE) / Constants.BASIS

      // Ensure vault is correct
      expect(await dragonX.vault()).to.be.equal(userBalanace - expectedTitanX)

      // Claim
      await expect(dragonX.connect(genesis).claimGenesis(Constants.ADDRESS_ZERO))
        .to.be.revertedWith('no balance')

      await expect(dragonX.connect(genesis).claimGenesis(await dragonX.getAddress()))
        .to.not.be.reverted

      await expect(dragonX.connect(genesis).claimGenesis(await titanX.getAddress()))
        .to.not.be.reverted

      // Compare values
      const dragonAddress = await dragonX.getAddress()
      expect(await dragonX.balanceOf(dragonAddress)).to.be.equal(0n)
      expect(await titanX.balanceOf(dragonAddress)).to.be.equal(userBalanace - expectedDragonX)
      expect(await dragonX.balanceOf(genesis.address)).to.be.equal(expectedDragonX)
      expect(await titanX.balanceOf(genesis.address)).to.be.equal(expectedTitanX)

      // Check vault
      await dragonX.updateVault()
      expect(await dragonX.vault()).to.be.equal(userBalanace - expectedTitanX)

      // prepare claim
      await ensureEthClaimable(fixture)
      const totalEthClaimable = await dragonX.totalEthClaimable()
      const genesisShare = (totalEthClaimable * Constants.GENESIS_SHARE) / Constants.BASIS
      await dragonX.connect(user).claim()

      const ethBalance = await ethers.provider.getBalance(genesis.address)
      const tx = await dragonX.connect(genesis).claimGenesis(Constants.ADDRESS_ZERO)
      const receipt = await tx.wait()
      expect(receipt).to.not.be.null

      if (!receipt) return
      const totalFee = receipt.gasUsed * receipt.gasPrice
      const expectedEthBalance = ethBalance - totalFee + genesisShare

      expect(await ethers.provider.getBalance(await dragonX.getAddress())).to.be.equal(0n)

      // Eventually, users receive an incentive fee for calling Titanx#triggerPayouts
      // hence greaterThanOrEqual is used for comparison
      expect(await ethers.provider.getBalance(genesis.address)).to.be.greaterThanOrEqual(expectedEthBalance)
    })
  })
})
