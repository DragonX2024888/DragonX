# Deployment Process Documentation for DragonX

## Overview
This document outlines the deployment process of DragonX, consisting of three primary contracts: DragonX, DragonBuyAndBurn, and TitanBuy, along with a supplementary contract DragonStake (automatically deployed by DragonX). The process is designed to ensure a seamless and secure deployment for auditors and stakeholders.

## Contract Components
1. **DragonX**: A primary contract in the ecosystem.
2. **DragonBuyAndBurn**: A contract that handles the purchase and burning of tokens.
3. **TitanBuy**: A contract dedicated to the purchase of TitanX tokens.
4. **DragonStake**: An auxiliary contract that interacts with DragonX.

## Deployment Steps

### Initial Setup
1. **Genesis Address Buys TitanX**
   - The Genesis address acquires a certain amount of TitanX tokens to initiate the deployment process.

2. **Deployment of Contracts by Genesis**
   - **DragonBuyAndBurn**: Deployed to manage the buy and burn mechanism.
   - **TitanBuy**: Deployed to facilitate the purchasing of TitanX tokens.
   - **DragonX**: Deployed as an auxiliary contract.

3. **Configuration of Contracts**
   - Genesis sets the DragonX contract address in both DragonBuyAndBurn and TitanBuy for integration and interaction purposes.

### Creating the Initial Pool (Detailed Step 6)
1. **Transfer of TitanX Balance**
   - TitanX tokens held by Genesis are sent to the DragonBuyAndBurn contract.

2. **Token Minting**
   - DragonBuyAndBurn mints an equivalent amount of DragonX tokens to maintain value parity.

3. **Pool Creation**
   - Using the newly minted DragonX tokens, DragonBuyAndBurn creates a liquidity pool.

4. **Initial Liquidity Minting**
   - DragonBuyAndBurn mints initial liquidity to stabilize the pool at inception.

5. **Activation of DragonX Minting**
   - DragonX begins its minting process at midnight of the same day, marking the start of its operational phase. Deploying initial liquidity before starting the mint phase prevents any front-running.
