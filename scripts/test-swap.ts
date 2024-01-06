import { ethers } from 'hardhat'

// A script to test the swap helper contract within the test environment
async function main() {
  const [_, user] = await ethers.getSigners()
  const swap = await ethers.getContractAt('SwapHelper', '0x27e2c0b96108306e8b0a8a1aff98ad170d0c8297')

  await swap.connect(user).swapETHForTitanX({
    value: ethers.parseEther('1'),
    gasLimit: '1000000',
  })
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
