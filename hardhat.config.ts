import 'dotenv/config'
import { HardhatUserConfig, task } from 'hardhat/config'
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-contract-sizer'

// Custom Tasks
task('set-timestamp', 'Set the blockchain timestamp')
  .addPositionalParam('timestamp', 'The timestamp to set as a Unix epoch time')
  .setAction(async ({ timestamp }) => {
    // Convert the provided timestamp to a number
    const timestampNum = parseInt(timestamp, 10)

    // Ensure the timestamp is valid
    if (Number.isNaN(timestampNum)) {
      throw new Error('Please provide a valid Unix epoch timestamp.')
    }

    const currentChainTimestamp = await time.latest()
    if (timestampNum < currentChainTimestamp) {
      console.log(`New timestamp is lower than previous block's timestamp, ${currentChainTimestamp}.`)
    }

    await time.increaseTo(timestampNum)
    console.log(`Timestamp set to ${new Date(timestampNum * 1000).toISOString()}`)
  })

task('get-timestamp', 'Get the blockchain timestamp')
  .setAction(async () => {
    const currentChainTimestamp = await time.latest()
    console.log(`Current chain timestamp is ${currentChainTimestamp}, 
      ${new Date(currentChainTimestamp * 1000).toISOString()}`)
  })

// Gas Report
let gasReportEnabled = false
let coinmarketcapApiKey = ''
if (process.env.COINMARKETCAP_API_KEY) {
  gasReportEnabled = true
  coinmarketcapApiKey = process.env.COINMARKETCAP_API_KEY
}

// Fund accounts in hardhat network with 10 eth
const eth = 1000
const wei = BigInt(eth) * BigInt(10 ** 18)
const accountBalance = wei.toString()

// RPC endpoint
let forking
if (process.env.RPC_ETH) {
  console.log(`Fork local hardhat network from ${process.env.RPC_ETH}`)
  forking = {
    url: process.env.RPC_ETH!,
    blockNumber: 18969000,
  }
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.20', // limit compiler version for other chains than ethereum mainnet
        settings: {
          optimizer: {
            enabled: true,
            runs: 9999,
          },
          metadata: {
            // do not include the metadata hash, since this is machine dependent
            // and we want all generated code to be deterministic
            bytecodeHash: 'none',
          },
        },
      },
      {
        version: '0.7.6',
        settings: {},
      },
    ],
  },
  networks: {
    ethereum: {
      url: process.env.RPC_ETH || '',
      accounts: {
        mnemonic: process.env.ETH_MNEMONIC || '',
      },
    },
    sepolia: {
      url: process.env.RPC_SEPOLIA || '',
      accounts: {
        mnemonic: process.env.SEPOLIA_MNEMONIC || '',
      },
    },
    localnode: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    hardhat: {
      allowBlocksWithSameTimestamp: true,
      forking,
      accounts: {
        mnemonic: 'grow shop dose curious brave jelly wreck chimney nature uncle tone town satisfy spare divorce ride census slice october bean glimpse digital need banner',
        accountsBalance: accountBalance,
        count: 10,
      },
      chainId: 31337,
    },
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 21,
    coinmarketcap: coinmarketcapApiKey,
    enabled: gasReportEnabled,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 72000000,
  },
}

export default config
