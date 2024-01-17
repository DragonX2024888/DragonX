# DragonX - #BuildOnTitanX
DragonX is a derivative on TitanX adoption. 

Through publicly callable functions maximum length TitanX stakes are created. 

The Ethereum rewards from these stakes are used to buy more TitanX off the market, perpetuating the growth of staking rewards and increasing the size of each subsequent buy and burn.

DragonX tokens are an incentive token for users who submit their TitanX tokens to be max staked during the launch phase. DragonX is bought and burned off the market with a portion of the Ethereum rewards earned through TitanX Stakes.

## Getting Started
> If you are using `nvm`, make sure to run `nvm use` to use the specified Node version.

### Setting up the Environment
Copy `.env.example` and create the minimum setup to run tests.

### Installation
First, clone the repository and navigate to the project directory. Then, run the following command to install all necessary dependencies:

```bash
yarn install
```

> make sure to use `yarn` version 4.x

### Compile Contracts
Compile the smart contracts with the following command:

```bash
yarn contracts:compile
```

### Run Tests
To run the contract tests, execute:

```bash
yarn contracts:test
```

> Tests run against TitanX and the WETH / TitanX pool, hence, make sure to provide an Ethereum mainnet-RPC.

> To run all tests and to reach maximum test-coverage, make sure to  set `LONG_RUNNING_TESTS=1` in your `.env` file

### Linting
To check for code style and potential errors, execute the lint command:

```bash
yarn lint
```

We plan to add linting as a pre-commit hook to ensure all committed code adheres to our coding standards.

## Frontend Development with Hardhat

### Overview
This project helps frontend developers to run a local Hardhat node with a pre-configured environment. It automatically sets up a local Ethereum blockchain with test accounts. Furthermore, it deploys DragonX and buys some TitanX with a user account for testing. Once the setup is complete, developers can use this environment for their frontend application development against a realistic Ethereum setup.

### Prerequisites

1. Ensure you have Node.js and yarn installed.
2. The necessary packages, including Hardhat, are installed.

> run `yarn install`, the repository comes with a cache
> make sure to setup the `.env` file

### Running the Script

To run the script and set up your local environment, execute:
```
yarn dev:local:run
```

This will:

1. Start a local Hardhat node.
2. Deploy the DragonX test fixture.
3. Buy TitanX with a user account.
4. Output a deployment summary to the consol and a file, detailing accounts, token addresses, and other relevant details.

### Usage

With the local Hardhat node running, frontend developers can now interact with the Ethereum blockchain using the provided test accounts and the smart contracts deployed. 

- When developing your frontend, connect to the local Ethereum node at `http://localhost:8545`.
- Use the private keys from the deployment summary to add the user account to Metamask and add the DragonX / TitanX token addresses
- Interact with DragonX as the user

### Manipulating Timestamps

DragonX and TitanX relies on UTC timestamps.

To modify the timestamp on your local chain, use the following command:
``` 
yarn dev:local:set-timestamp 1678402800
```

To retrieve the current timestamp from your local chain, execute:
```
yarn dev:local:get-timestamp
```

The commands will fail if your local chain is not running (`yarn dev:local:run`).

### Shutting Down

To shut down the Hardhat node gracefully, simply press `Ctrl + C`.

### Notes

1. Always remember, the test accounts and the environment are for development purposes only. Do not use in production.
2. Every time you run the script, it will set up a fresh environment, so any prior transactions or changes made in the local environment will be reset.
