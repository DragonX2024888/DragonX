// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

/* Common */
uint256 constant BASIS = 10_000;
uint256 constant SECONDS_IN_DAY = 86400;
uint256 constant SCALING_FACTOR_1e3 = 1e3;
uint256 constant SCALING_FACTOR_1e6 = 1e6;
uint256 constant SCALING_FACTOR_1e7 = 1e7;
uint256 constant SCALING_FACTOR_1e11 = 1e11;
uint256 constant SCALING_FACTOR_1e18 = 1e18;

/* TitanX staking */
uint256 constant TITANX_MAX_STAKE_PER_WALLET = 1000;
uint256 constant TITANX_MIN_STAKE_LENGTH = 28;
uint256 constant TITANX_MAX_STAKE_LENGTH = 3500;

/* TitanX Stake Longer Pays Better bonus */
uint256 constant TITANX_LPB_MAX_DAYS = 2888;
uint256 constant TITANX_LPB_PER_PERCENT = 825;

uint256 constant TITANX_BPB_MAX_TITAN = 100 * 1e9 * SCALING_FACTOR_1e18; //100 billion
uint256 constant TITANX_BPB_PER_PERCENT = 1_250_000_000_000 *
    SCALING_FACTOR_1e18;

/* Addresses */
address constant TITANX_ADDRESS = 0xF19308F923582A6f7c465e5CE7a9Dc1BEC6665B1;
address constant WETH9_ADDRESS = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
address constant UNI_SWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
address constant UNI_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
address constant UNI_NONFUNGIBLEPOSITIONMANAGER = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;

/* Uniswap Liquidity Pools (DragonX, TitanX) */
uint24 constant FEE_TIER = 10000;
int24 constant MIN_TICK = -887200;
int24 constant MAX_TICK = 887200;
uint160 constant INITIAL_SQRT_PRICE_TITANX_DRAGONX = 79228162514264337593543950336; // 1:1

/* DragonX Constants */
uint256 constant INCENTIVE_FEE = 300;
uint256 constant REDUCED_MINT_RATIO = 9500;
