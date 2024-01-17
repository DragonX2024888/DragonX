import { ethers } from 'hardhat'

async function main() {
  // Contracts are deployed using the first signer/account by default
  const [genesis] = await ethers.getSigners()
  const dragonBuyAndBurn = await ethers.getContractAt('DragonBuyAndBurn', '0x1A4330EAf13869D15014abcA69516FC6AB36E54D')
  const titanX = await ethers.getContractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')

  const initialLiqudity = await titanX.balanceOf(genesis.address)
  const approvalTx = await titanX.connect(genesis).approve(await dragonBuyAndBurn.getAddress(), initialLiqudity)
  await approvalTx.wait()

  console.log(`Creating initial liquidity ${ethers.formatEther(initialLiqudity)} TITANX`)
  const tx = await dragonBuyAndBurn.connect(genesis).createInitialLiquidity(initialLiqudity)
  await tx.wait()
  console.log('Initial liquidity created.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
