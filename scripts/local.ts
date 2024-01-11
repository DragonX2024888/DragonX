import * as fs from 'fs'
import { setTimeout } from 'timers/promises'

import { ethers, config as hardhatConfig } from 'hardhat'
import type {
  HardhatNetworkHDAccountsConfig,
} from 'hardhat/types'
import {
  time,
} from '@nomicfoundation/hardhat-toolbox/network-helpers'

import { deployDragonXWithTitanXStakeActive, ensureEthClaimable } from '../test/Fixture'

const outputFile = 'dev-environment-summary.txt'

function writeToSummary(data: string) {
  fs.appendFileSync(outputFile, data + '\n')
}

function getPrivateKey(index: number): string {
  const accounts = hardhatConfig.networks.hardhat.accounts as HardhatNetworkHDAccountsConfig
  const accountWallet = ethers.HDNodeWallet.fromPhrase(
    accounts.mnemonic,
    undefined,
    `m/44'/60'/0'/0/${index}`,
  )
  return accountWallet.privateKey
}

async function deployDragonX() {
  const fixture = await deployDragonXWithTitanXStakeActive()
  await ensureEthClaimable(fixture)

  return fixture
}

async function main() {
  // Empty file if it exists
  fs.writeFile(outputFile, '', (err) => {
    if (err) {
      console.error('Error emptying the file:', err)
    }
  })

  console.log('Start deploying local dev-environment.')
  const ts = Math.floor(Date.now() / 1000)
  await time.increaseTo(ts)

  // Deploy DragoX fixture
  const {
    dragonX,
    dragonBuyAndBurn,
    titanBuy,
    titanX,
    swap,
    genesis,
    user,
  } = await deployDragonX()

  // users swaps 1ETH for DragonX from market
  await swap.connect(user).swapETHForTitanX({
    value: ethers.parseEther('1'),
    gasLimit: '1000000',
  })

  // Output formatting begins here:
  writeToSummary('===========================')
  writeToSummary('   DEPLOYMENT SUMMARY')
  writeToSummary('===========================')

  writeToSummary('\n💻 Node:')
  writeToSummary('---------------------------')
  writeToSummary('🌐 RPC: http://localhost:8545/')
  writeToSummary('🔗 Chain ID: 31337')

  writeToSummary('\n💼 Accounts:')
  writeToSummary('---------------------------')
  writeToSummary(`Genesis Deployer Address: ${genesis.address}\nPrivate Key: ${getPrivateKey(0)}`)
  writeToSummary(`\nUser Address: ${user.address}\nPrivate Key: ${getPrivateKey(1)}`)

  writeToSummary('\n🏭 Contracts:')
  writeToSummary('---------------------------')
  writeToSummary(`DragonX Address: ${await dragonX.getAddress()}`)
  writeToSummary(`TitanX Address: ${await titanX.getAddress()}`)
  writeToSummary(`DragonBuyAndBurn Address: ${await dragonBuyAndBurn.getAddress()}`)
  writeToSummary(`TitanBuy Address: ${await titanBuy.getAddress()}`)

  writeToSummary('\n🚀 Swap ETH to TitanX:')
  writeToSummary('---------------------------')
  writeToSummary(`Helper Contract Address: ${await swap.getAddress()}`)

  writeToSummary('\nShutdown with (Ctrl+C)')
  writeToSummary('\n===========================')
  writeToSummary('   END DEPLOYMENT SUMMARY')
  writeToSummary('===========================\n')

  console.log('Local dev-environment successfully deployed.')

  while (true) {
    try {
      console.log('Trigger Payouts')
      await titanX.triggerPayouts()
      // await ethers.provider.send('evm_mine')
      // If the evm_mine call is successful, wait for 5 seconds before the next iteration
      await setTimeout(5000)
    } catch (error) {
      console.error('Error occurred:', error)
      // Retry logic: wait for 5 seconds before retrying
      // await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
