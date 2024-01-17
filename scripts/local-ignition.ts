import { ethers } from 'hardhat'

async function main() {
  // Contracts are deployed using the first signer/account by default
  const [funding] = await ethers.getSigners()
  const genesis = process.env.GENESIS_ADDRESS as string

  // Factories
  const fSwap = await ethers.getContractFactory('SwapHelper')

  // Buy initial liquidity
  const swap = await (await fSwap.deploy()).waitForDeployment()
  await (await swap.connect(funding).swapETHForTitanX({ value: ethers.parseEther('5') })).wait()

  // Fund Genesis
  const titanX = await ethers.getContractAt('ITitanX', '0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1')
  await (await titanX.connect(funding).transfer(genesis, await titanX.balanceOf(funding.address))).wait()
  await (await funding.sendTransaction({
    to: genesis,
    value: ethers.parseEther('2'),
  })).wait()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
