import { ethers, ignition } from 'hardhat'
import {
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import * as progress from 'cli-progress'

import { DragonX, TitanBuy, DragonBuyAndBurn } from '../typechain-types/contracts'
import { SwapHelper } from '../typechain-types/contracts/mocks'
import { iTitanXSol } from '../typechain-types/contracts/lib/interfaces'
import IgniteDragonX from '../ignition/modules/DragonX'

import * as Constants from './Constants'

interface Fixture {
  dragonX: DragonX;
  titanX: iTitanXSol.ITitanX;
  titanBuy: TitanBuy;
  dragonBuyAndBurn: DragonBuyAndBurn;
  swap: SwapHelper;
  genesis: HardhatEthersSigner;
  user: HardhatEthersSigner;
  others: HardhatEthersSigner[];
  initialLiquidity: bigint;
}

export async function deployDragonXFixture(): Promise<Fixture> {
  // Contracts are deployed using the first signer/account by default
  const [genesis, user, firstUser, ...others] = await ethers.getSigners()

  // Factories
  const fSwap = await ethers.getContractFactory('SwapHelper')

  // Buy initial liquidity
  const swap = await fSwap.deploy()
  const titanX = await ethers.getContractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')
  await swap.connect(genesis).swapETHForTitanX({ value: ethers.parseEther('28') })

  // Deploy with ignition
  const deployment = await ignition.deploy(IgniteDragonX)
  const dragonX: DragonX = deployment.dragonX as unknown as DragonX
  const titanBuy: TitanBuy = deployment.titanBuy as unknown as TitanBuy
  const dragonBuyAndBurn: DragonBuyAndBurn = deployment.dragonBuyAndBurn as unknown as DragonBuyAndBurn

  const initialLiquidity = await dragonX.totalSupply()

  await titanBuy.setDragonContractAddress(await dragonX.getAddress())
  await dragonBuyAndBurn.setDragonContractAddress(await dragonX.getAddress())

  // Swap 1 TitanX for DragonX to make sure at least one observation entry in LP pool exists
  await swap.connect(firstUser).swapETHForTitanX({ value: ethers.parseEther('0.1') })
  await titanX.connect(firstUser).approve(await swap.getAddress(), await titanX.balanceOf(firstUser.address))
  await swap.connect(firstUser).swapTitanToDragon(ethers.parseEther('1'), await dragonX.getAddress())

  return { dragonX, titanX, titanBuy, dragonBuyAndBurn, swap, genesis, user, others, initialLiquidity }
}

export async function deployDragonXFixtureNoInitialLiquidityMinted(): Promise<Fixture> {
  // Contracts are deployed using the first signer/account by default
  const [genesis, user, ...others] = await ethers.getSigners()

  // Factories
  const fDragonX = await ethers.getContractFactory('DragonX')
  const fSwap = await ethers.getContractFactory('SwapHelper')
  const fTitanBuy = await ethers.getContractFactory('TitanBuy')
  const fDragonBuyAndBurn = await ethers.getContractFactory('DragonBuyAndBurn')

  // Deploy/Get contracts
  const titanX = await ethers.getContractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')
  const titanBuy = await fTitanBuy.deploy()
  const swap = await fSwap.deploy()
  const dragonBuyAndBurn = await fDragonBuyAndBurn.deploy()
  const dragonX = await fDragonX.deploy(
    await titanBuy.getAddress(),
    await dragonBuyAndBurn.getAddress(),
  )

  await titanBuy.setDragonContractAddress(await dragonX.getAddress())
  await dragonBuyAndBurn.setDragonContractAddress(await dragonX.getAddress())

  // The genesis address market-buys TitanX for initial liquidtiy
  await swap.connect(genesis).swapETHForTitanX({ value: ethers.parseEther('28') })
  const initialLiquidity = await titanX.balanceOf(genesis.address)
  await titanX.connect(genesis).approve(await dragonBuyAndBurn.getAddress(), initialLiquidity)

  return { dragonX, titanX, titanBuy, dragonBuyAndBurn, swap, genesis, user, others, initialLiquidity }
}

export async function deployDragonXUserHasMintedFixture(): Promise<Fixture> {
  const fixture = await deployDragonXFixture()
  const { user, dragonX, titanX, swap } = fixture

  // Activate mint phase
  await time.increaseTo(await fixture.dragonX.mintPhaseBegin())

  // Buy some TitanX
  await swap.connect(user).swapETHForTitanX({ value: ethers.parseEther('1') })

  // Mint DragonX
  const balance = await titanX.balanceOf(user.address)
  await titanX.connect(user).approve(await dragonX.getAddress(), balance)
  await dragonX.connect(user).mint(balance)

  return fixture
}

export async function deployDragonXWithTitanXStakeActive(): Promise<Fixture> {
  const fixture = await deployDragonXUserHasMintedFixture()

  // Activate first stake
  await time.increaseTo(await fixture.dragonX.nextStakeTs())

  // User calls stake
  await fixture.dragonX.connect(fixture.user).stake()

  return fixture
}

export async function ensureEthClaimable(fixture: Fixture) {
  const { dragonX, titanX, others } = fixture
  // randomly select an account
  const idx: number = Math.floor(Math.random() * 5)
  const user = others[idx]

  // Open at least one stake
  if (await dragonX.totalStakesOpened() === 0n) {
    await time.increaseTo(await dragonX.nextStakeTs())
    await dragonX.stake()
  }

  while (await dragonX.totalEthClaimable() === 0n) {
    // Start a new mint (fresh ETH to distribute)
    await titanX.manualDailyUpdate()
    const mintCost = (await titanX.getCurrentMintCost() * 100n * 1n) / 100n
    await titanX.connect(user).startMint(100, 200, { value: mintCost })

    // Trigger payouts (which triggers daily update)
    await titanX.connect(user).triggerPayouts()

    // Increase time by a day
    await time.increase(Constants.SECONDS_PER_DAY * 10n)
  }
}

export async function deployMaximumNumberOfStakesPerDragonStakeInstance(fixture: Fixture) {
  const { dragonX, titanBuy, user } = fixture
  const dragonStake = await ethers.getContractAt('DragonStake', await dragonX.activeDragonStakeContract())
  const bar = new progress.SingleBar({}, progress.Presets.shades_classic)

  console.log(`Opening ${Constants.MAX_NUM_STAKES} TitanX stakes on currently active DragonStake instance`)
  bar.start(Number(Constants.MAX_NUM_STAKES), 0)
  while (await dragonStake.openedStakes() < Constants.MAX_NUM_STAKES) {
    // make sure ETH is claimable
    await ensureEthClaimable(fixture)

    // claim ETH
    await dragonX.connect(user).claim()

    // Buy TitanX
    await titanBuy.connect(user).buyTitanX()

    // Ensure cooldown is done
    if (await time.latest() < await dragonX.nextStakeTs()) {
      await time.increaseTo(await dragonX.nextStakeTs())
    }

    // open a stake
    await dragonX.connect(user).stake()
    bar.update(Number(await dragonStake.openedStakes()))
  }
  bar.stop()
}

export async function deployDragonXWithMaxedOutDragonStakeContract(): Promise<Fixture> {
  const fixture = await deployDragonXUserHasMintedFixture()

  // Max out Dragon-Stake contract
  await deployMaximumNumberOfStakesPerDragonStakeInstance(fixture)

  return fixture
}
