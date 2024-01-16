// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// UniSwap
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// OpenZeppelins
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Library
import "./lib/Constants.sol";
import "./lib/interfaces/IWETH.sol";
import "./lib/interfaces/INonfungiblePositionManager.sol";
import "./lib/uniswap/PoolAddress.sol";
import "./lib/uniswap/Oracle.sol";
import "./lib/uniswap/TickMath.sol";

// Other
import "./DragonX.sol";

import "hardhat/console.sol";

contract DragonBuyAndBurn is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH9;
    using SafeERC20 for DragonX;

    // -----------------------------------------
    // Type declarations
    // -----------------------------------------
    /**
     * @dev Represents the information about a Uniswap V3 liquidity pool position token.
     * This struct is used to store details of the position token, specifically for a single full range position.
     */
    struct TokenInfo {
        uint80 tokenId; // The ID of the position token in the Uniswap V3 pool.
        uint128 liquidity; // The amount of liquidity provided in the position.
        int24 tickLower; // The lower end of the price range for the position.
        int24 tickUpper; // The upper end of the price range for the position.
    }

    // -----------------------------------------
    // State variables
    // -----------------------------------------
    /**
     * @dev The address of the DragonX Contract.
     */
    address public DRAGONX_ADDRESS;

    /**
     * @dev Maximum slippage percentage acceptable when buying TitanX with WETH and DragonX with TitanX.
     * Slippage is expressed as a percentage (e.g., 5 for 5% slippage).
     */
    uint256 public slippage;

    /**
     * @dev Tracks the total amount of WETH used for burning DragonX tokens.
     * This accumulates the WETH spent over time in buy and burn transactions.
     */
    uint256 public totalWethUsedForBuyAndBurns;

    /**
     * @dev Tracks the total amount of DragonX tokens purchased and burned.
     * This accumulates the DragonX bought and subsequently burned over time.
     */
    uint256 public totalDragonBurned;

    /**
     * @dev Tracks the total amount of DragonX tokens collected through fees and burned.
     * This accumulates the DragonX collected trough liquidity fees and subsequently burned over time.
     */
    uint256 public totalDragonFeesBurned;

    /**
     * @dev Tracks the total amount of TitanX tokens collected through fees and send to DragonX for staking.
     * This accumulates the TitanX collected trough liquidity fees and subsequently send to DragonX over time.
     */
    uint256 public totalTitanFeeCollected;

    /**
     * @dev Tracks the current cap on the amount of WETH that can be used per individual swap.
     * This cap can be adjusted to control the maximum size of each swap transaction.
     */
    uint256 public capPerSwap;

    /**
     * @dev Records the timestamp of the last time the buy and burn function was called.
     * Used for tracking the interval between successive buy and burn operations.
     */
    uint256 public lastCallTs;

    /**
     * @dev Specifies the interval in seconds between allowed buy and burn operations.
     * This sets a minimum time gap that must elapse before the buy and burn function can be called again.
     */
    uint256 public interval;

    /**
     * @dev Address of the DragonX-TitanX Uniswap V3 pool.
     * This variable stores the contract address of the Uniswap V3 pool where DragonX and TitanX tokens are traded.
     */
    address public dragonTitanPoolAddress;

    /**
     * @dev Stores the position token information, specifically for a single full range position in the Uniswap V3 pool.
     * This variable is kept private to maintain control over its access and modifications.
     */
    TokenInfo private _tokenInfo;

    /**
     * @dev Specifies the value in minutes for the timed-weighted average when calculating the TitanX price (in WETH)
     * for slippage protection.
     */
    uint32 private _titanPriceTwa;

    /**
     * @dev Specifies the value in minutes for the timed-weighted average when calculating the DragonX price (in TitanX)
     * for slippage protection.
     */
    uint32 private _dragonPriceTwa;

    // -----------------------------------------
    // Errors
    // -----------------------------------------
    /**
     * @dev Thrown when the provided address is address(0)
     */
    error InvalidDragonAddress();

    /**
     * @dev Thrown when the function caller is not authorized or expected.
     */
    error InvalidCaller();

    /**
     * @dev Thrown when trying to buy and burn DragonX but the cooldown period is still active.
     */
    error CooldownPeriodActive();

    /**
     * @dev Thrown when trying to buy and burn DragonX but there is no WETH in the contract.
     */
    error NoWethToBuyAndBurnDragon();

    // -----------------------------------------
    // Events
    // -----------------------------------------
    /**
     * @notice Emitted when DragonX tokens are bought with WETH (swapping through TitanX) and subsequently burned.
     * @dev This event indicates both the purchase and burning of DragonX tokens in a single transaction.
     * @param weth The amount of WETH used to buy and burn Titan tokens.
     * @param dragon The amount of DragonX tokens that were bought and then burned.
     * @param caller The address of the user or contract that initiated the transaction.
     */
    event BoughtAndBurned(
        uint256 indexed weth,
        uint256 indexed dragon,
        address indexed caller
    );

    /**
     * @notice Emitted when fees are collected in both DragonX and TitanX tokens.
     * @dev This event is triggered when a fee collection transaction is completed.
     * @param dragon The amount of dragon collected as fees.
     * @param titan The amount of Titan tokens collected as fees.
     * @param caller The address of the user or contract that initiated the fee collection.
     */
    event CollectedFees(
        uint256 indexed dragon,
        uint256 indexed titan,
        address indexed caller
    );

    // -----------------------------------------
    // Modifiers
    // -----------------------------------------

    // -----------------------------------------
    // Constructor
    // -----------------------------------------
    /**
     * @notice Creates a new instance of the contract.
     * @dev Initializes the contract with predefined values for `capPerSwap`, `slippage`, and `interval`.
     *      Inherits from Ownable and sets the contract deployer as the initial owner.
     *      - Sets `capPerSwap` to 1 ETH, limiting the maximum amount of WETH that can be used in each swap.
     *      - Sets `slippage` to 5%, defining the maximum allowable price movement in a swap transaction.
     *      - Sets `interval` to 15 minutes, establishing the minimum time between consecutive buy and burn operations.
     *      - Sets `_titanPriceTwa` to 15 minutes, establishing a protection against sandwich-attacks.
     *      - Sets `_dragonPriceTwa` to 15 minutes, establishing a protection against sandwich-attacks.
     */
    constructor() Ownable(msg.sender) {
        // Set the cap for each swap to 1 ETH
        capPerSwap = 1 ether;
        // Set the maximum slippage to 5%
        slippage = 5;
        // Set the minimum interval between buy and burn calls to 15 minutes
        interval = 15 * 60;
        // set initial TWA to 15 mins
        _titanPriceTwa = 15;
        _dragonPriceTwa = 15;
    }

    // -----------------------------------------
    // Receive function
    // -----------------------------------------
    /**
     * @notice Wrap incoming ETH into WETH
     * @dev This receive function automatically wraps any incoming ETH into WETH, except when the sender is the WETH9 contract itself.
     */
    receive() external payable {
        if (msg.sender != WETH9_ADDRESS) {
            IWETH9(WETH9_ADDRESS).deposit{value: msg.value}();
        }
    }

    // -----------------------------------------
    // Fallback function
    // -----------------------------------------
    /**
     * @notice Fallback function that disallows direct ETH transfers
     * @dev This fallback function reverts any transactions that do not contain data or are not from the WETH9 contract.
     */
    fallback() external {
        revert("Fallback triggered");
    }

    // -----------------------------------------
    // External functions
    // -----------------------------------------
    /**
     * Buy and Burn DragonX Tokens
     * @notice Buys DragonX tokens using WETH and then burns them to manage the token's supply and value.
     * @dev This function swaps WETH for DragonX tokens using a swap router, then burns the DragonX tokens.
     *      It includes security checks to prevent abuse (e.g., reentrancy, bot interactions, cooldown periods).
     *      The function also handles an incentive fee for the caller.
     * @return amountOut The amount of DragonX tokens bought and burned.
     * @custom:revert InvalidDragonAddress if the DragonX address is not set.
     * @custom:revert InvalidCaller if the function is called by a smart contract (to prevent bot interactions).
     * @custom:revert CooldownPeriodActive if the function is called again before the cooldown period has elapsed.
     * @custom:revert NoWethToBuyAndBurnDragon if there is no WETH available for the transaction after deducting the incentive fee.
     *
     * Emits a BoughtAndBurned event after successfully buying and burning DragonX tokens.
     */
    function buyAndBurnDragonX()
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        // Ensure DragonX address has been set
        if (DRAGONX_ADDRESS == address(0)) {
            revert InvalidDragonAddress();
        }
        //prevent contract accounts (bots) from calling this function
        if (msg.sender != tx.origin) {
            revert InvalidCaller();
        }

        //a minium gap of `interval` between each call
        if (block.timestamp - lastCallTs <= interval) {
            revert CooldownPeriodActive();
        }
        lastCallTs = block.timestamp;

        ISwapRouter swapRouter = ISwapRouter(UNI_SWAP_ROUTER);
        IWETH9 weth = IWETH9(WETH9_ADDRESS);

        // WETH Balance of this contract
        uint256 amountIn = weth.balanceOf(address(this));
        uint256 wethCap = capPerSwap;
        if (amountIn > wethCap) {
            amountIn = wethCap;
        }

        uint256 incentiveFee = (amountIn * INCENTIVE_FEE) / BASIS;
        weth.withdraw(incentiveFee);
        amountIn -= incentiveFee;

        if (amountIn == 0) {
            revert NoWethToBuyAndBurnDragon();
        }

        // Approve the router to spend WETH
        weth.safeIncreaseAllowance(address(swapRouter), amountIn);

        // Setup the swap-path, swapp
        bytes memory path = abi.encodePacked(
            WETH9_ADDRESS,
            FEE_TIER,
            TITANX_ADDRESS,
            FEE_TIER,
            DRAGONX_ADDRESS
        );

        uint256 amountOutMinimum = calculateMinimumDragonAmount(amountIn);

        // Swap parameters
        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: address(this),
                deadline: block.timestamp + 1,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });

        // Execute the swap
        amountOut = swapRouter.exactInput(params);

        // Burn the DragonX bought
        DragonX(payable(DRAGONX_ADDRESS)).burn();

        // Update state
        totalWethUsedForBuyAndBurns += amountIn;
        totalDragonBurned += amountOut;

        // Send incentive fee
        Address.sendValue(payable(_msgSender()), incentiveFee);

        // Emit events
        emit BoughtAndBurned(amountIn, amountOut, msg.sender);
    }

    /**
     * Collect Fees from Liquidity Pool
     * @notice Collects accumulated fees from the liquidity pool and performs actions on them.
     * @dev This function handles the collection of fees from the liquidity pool consisting of DragonX and TitanX tokens.
     *      It involves the following steps:
     *        1. Retrieve the caller's address.
     *        2. Call `_collectFees()` and to get the amounts of DragonX (amount0) and TitanX (amount1) collected.
     *        3. Assign the correct amounts to `dragon` and `titan` variables based on the token order in the pool.
     *        4. Update `totalDragonFeesBurned`, `totalTitanFeeCollected`, and `totalDragonBurned` state variables.
     *        5. Burn the collected DragonX tokens by calling the `burn` method on the DragonX contract.
     *        6. Transfer the collected TitanX tokens to the DragonX address, for staking.
     *        7. Update the DragonX vault.
     *        7. Emit a `CollectedFees` event indicating the amounts collected and the caller.
     *      Uses the `nonReentrant` modifier to prevent reentrancy attacks.
     * @custom:modifier nonReentrant Ensures the function cannot be re-entered while it is being executed.
     */
    function collectFees() public nonReentrant {
        address sender = _msgSender();
        (uint256 amount0, uint256 amount1) = _collectFees();

        uint256 dragon;
        uint256 titan;

        if (DRAGONX_ADDRESS < TITANX_ADDRESS) {
            dragon = amount0;
            titan = amount1;
        } else {
            titan = amount0;
            dragon = amount1;
        }

        totalDragonFeesBurned += dragon;
        totalTitanFeeCollected += titan;
        totalDragonBurned += dragon;

        DragonX dragonX = DragonX(payable(DRAGONX_ADDRESS));
        dragonX.burn();

        IERC20(TITANX_ADDRESS).safeTransfer(DRAGONX_ADDRESS, titan);
        dragonX.updateVault();

        emit CollectedFees(dragon, titan, sender);
    }

    /**
     * @notice A one-time function for creating the initial liquidity to kick off the minting phase in DragonX.
     * @dev This function sets up the initial liquidity in the DragonX-TitanX pool with a 1:1 ratio.
     * It's only callable by the contract owner and can be executed only once.
     * @param initialLiquidityAmount The amount of liquidity to add initially to the pool.
     */
    function createInitialLiquidity(
        uint256 initialLiquidityAmount
    ) external onlyOwner {
        // Verify that the DragonX token address is set
        if (DRAGONX_ADDRESS == address(0)) {
            revert InvalidDragonAddress();
        }

        // Initialize DragonX and TitanX token interfaces
        DragonX dragonX = DragonX(payable(DRAGONX_ADDRESS));
        IERC20 titanX = IERC20(TITANX_ADDRESS);

        // Mint the initial DragonX liquidity.
        // This will fail if the initial liquidity has already been minted.
        dragonX.mintInitialLiquidity(initialLiquidityAmount);

        // Check if the caller has enough TitanX tokens and has allowed this contract to spend them.
        require(
            titanX.allowance(_msgSender(), address(this)) >=
                initialLiquidityAmount,
            "allowance too low"
        );
        require(
            titanX.balanceOf(_msgSender()) >= initialLiquidityAmount,
            "balance too low"
        );

        // Transfer the specified amount of TitanX tokens from the caller to this contract.
        titanX.safeTransferFrom(
            _msgSender(),
            address(this),
            initialLiquidityAmount
        );

        // Approve the Uniswap non-fungible position manager to spend the tokens.
        dragonX.safeIncreaseAllowance(
            UNI_NONFUNGIBLEPOSITIONMANAGER,
            initialLiquidityAmount
        );
        titanX.safeIncreaseAllowance(
            UNI_NONFUNGIBLEPOSITIONMANAGER,
            initialLiquidityAmount
        );

        // Create the initial liquidity pool in Uniswap V3.
        _createPool(initialLiquidityAmount);

        // Mint the initial position in the pool.
        _mintInitialPosition(initialLiquidityAmount);
    }

    /**
     * @dev Retrieves the total amount of Wrapped Ethereum (WETH) available to buy DragonX.
     * This function queries the balance of WETH held by the contract itself.
     *
     * @notice Use this function to get the total WETH available for purchasing DragonX.
     *
     * @return balance The total amount of WETH available, represented as a uint256.
     */
    function totalWethForBuyAndBurn() external view returns (uint256 balance) {
        return IERC20(WETH9_ADDRESS).balanceOf(address(this));
    }

    /**
     * @dev Calculates the incentive fee for executing the buyAndBurnDragonX function.
     * The fee is computed based on the WETH amount designated for the next DragonX purchase,
     * using the `wethForNextBuyAndBurn` function, and applying a predefined incentive fee rate.
     *
     * @notice Used to determine the incentive fee for running the buyAndBurnDragonX function.
     *
     * @return fee The calculated incentive fee, represented as a uint256.
     * This value is calculated by taking the product of `wethForNextBuyAndBurn()` and
     * `INCENTIVE_FEE`, then dividing by `BASIS` to normalize the fee calculation.
     */
    function incentiveFeeForRunningBuyAndBurnDragonX()
        external
        view
        returns (uint256 fee)
    {
        uint256 forBuy = wethForNextBuyAndBurn();
        fee = (forBuy * INCENTIVE_FEE) / BASIS;
    }

    /**
     * @notice Sets the address of the DragonX contract
     * @dev This function allows the contract owner to update the address of the contract contract.
     * It includes a check to prevent setting the address to the zero address.
     * @param dragonX The new address to be set for the contract.
     * @custom:revert InvalidAddress If the provided address is the zero address.
     */
    function setDragonContractAddress(address dragonX) external onlyOwner {
        if (dragonX == address(0)) {
            revert InvalidDragonAddress();
        }
        DRAGONX_ADDRESS = dragonX;
    }

    /**
     * @notice set weth cap amount per buynburn call. Only callable by owner address.
     * @param amount amount in 18 decimals
     */
    function setCapPerSwap(uint256 amount) external onlyOwner {
        capPerSwap = amount;
    }

    /**
     * @notice set slippage % for buynburn minimum received amount. Only callable by owner address.
     * @param amount amount from 0 - 50
     */
    function setSlippage(uint256 amount) external onlyOwner {
        require(amount >= 5 && amount <= 15, "5-15% only");
        slippage = amount;
    }

    /**
     * @notice set the buy and burn interval in seconds. Only callable by owner address.
     * @param secs amount in seconds
     */
    function setBuyAndBurnInterval(uint256 secs) external onlyOwner {
        require(secs >= 60 && secs <= 43200, "1m-12h only");
        interval = secs;
    }

    /**
     * @notice set the TWA value used when calculting the TitanX price. Only callable by owner address.
     * @param mins TWA in minutes
     */
    function setTitanPriceTwa(uint32 mins) external onlyOwner {
        require(mins >= 5 && mins <= 60, "5m-1h only");
        _titanPriceTwa = mins;
    }

    /**
     * @notice set the TWA value used when calculting the TitanX price. Only callable by owner address.
     * @param mins TWA in minutes
     */
    function setDragonPriceTwa(uint32 mins) external onlyOwner {
        require(mins >= 5 && mins <= 60, "5m-1h only");
        _dragonPriceTwa = mins;
    }

    // -----------------------------------------
    // Public functions
    // -----------------------------------------
    /**
     * Get a quote for TitanX for a given amount of ETH
     * @notice Uses Time-Weighted Average Price (TWAP) and falls back to the pool price if TWAP is not available.
     * @param baseAmount The amount of ETH for which the TitanX quote is needed.
     * @return quote The amount of TitanX.
     * @dev This function computes the TWAP of TitanX in ETH using the Uniswap V3 pool for TitanX/WETH and the Oracle Library.
     *      Steps to compute the TWAP:
     *        1. Compute the pool address with the PoolAddress library using the Uniswap factory address,
     *           the addresses of WETH9 and TitanX, and the fee tier.
     *        2. Determine the period for the TWAP calculation, limited by the oldest available observation from the Oracle.
     *        3. If `secondsAgo` is zero, use the current price from the pool; otherwise, consult the Oracle Library
     *           for the arithmetic mean tick for the calculated period.
     *        4. Convert the arithmetic mean tick to the square root price (sqrtPriceX96) and calculate the price
     *           based on the specified baseAmount of ETH.
     */
    function getTitanQuoteForEth(
        uint256 baseAmount
    ) public view returns (uint256 quote) {
        address poolAddress = PoolAddress.computeAddress(
            UNI_FACTORY,
            PoolAddress.getPoolKey(WETH9_ADDRESS, TITANX_ADDRESS, FEE_TIER)
        );
        uint32 secondsAgo = _titanPriceTwa * 60;
        uint32 oldestObservation = OracleLibrary.getOldestObservationSecondsAgo(
            poolAddress
        );

        // Limit to oldest observation
        if (oldestObservation < secondsAgo) {
            secondsAgo = oldestObservation;
        }

        uint160 sqrtPriceX96;
        if (secondsAgo == 0) {
            // Default to current price
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
            (sqrtPriceX96, , , , , , ) = pool.slot0();
        } else {
            // Consult the Oracle Library for TWAP
            (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
                poolAddress,
                secondsAgo
            );

            // Convert tick to sqrtPriceX96
            sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
        }

        return
            OracleLibrary.getQuoteForSqrtRatioX96(
                sqrtPriceX96,
                baseAmount,
                WETH9_ADDRESS,
                TITANX_ADDRESS
            );
    }

    /**
     * Get a quote for DragonX for a given amount of TitanX
     * @notice Uses Time-Weighted Average Price (TWAP) and falls back to the pool price if TWAP is not available.
     * @param baseAmount The amount of TitanX for which the DragonX quote is needed.
     * @return quote The amount of DragonX
     * @dev This function computes the TWAP of TitanX in ETH using the Uniswap V3 pool for TitanX/WETH and the Oracle Library.
     *      Steps to compute the TWAP:
     *        1. Compute the pool address with the PoolAddress library using the Uniswap factory address,
     *           the addresses of WETH9 and TitanX, and the fee tier.
     *        2. Determine the period for the TWAP calculation, limited by the oldest available observation from the Oracle.
     *        3. If `secondsAgo` is zero, use the current price from the pool; otherwise, consult the Oracle Library
     *           for the arithmetic mean tick for the calculated period.
     *        4. Convert the arithmetic mean tick to the square root price (sqrtPriceX96) and calculate the price
     *           based on the specified baseAmount of ETH.
     */
    function getDragonQuoteForTitan(
        uint256 baseAmount
    ) public view returns (uint256 quote) {
        address poolAddress = PoolAddress.computeAddress(
            UNI_FACTORY,
            PoolAddress.getPoolKey(DRAGONX_ADDRESS, TITANX_ADDRESS, FEE_TIER)
        );
        uint32 secondsAgo = _dragonPriceTwa * 60;
        uint32 oldestObservation = OracleLibrary.getOldestObservationSecondsAgo(
            poolAddress
        );

        // Limit to oldest observation
        if (oldestObservation < secondsAgo) {
            secondsAgo = oldestObservation;
        }

        uint160 sqrtPriceX96;
        if (secondsAgo == 0) {
            // Default to current price
            IUniswapV3Pool pool = IUniswapV3Pool(poolAddress);
            (sqrtPriceX96, , , , , , ) = pool.slot0();
        } else {
            // Consult the Oracle Library for TWAP
            (int24 arithmeticMeanTick, ) = OracleLibrary.consult(
                poolAddress,
                secondsAgo
            );

            // Convert tick to sqrtPriceX96
            sqrtPriceX96 = TickMath.getSqrtRatioAtTick(arithmeticMeanTick);
        }

        return
            OracleLibrary.getQuoteForSqrtRatioX96(
                sqrtPriceX96,
                baseAmount,
                TITANX_ADDRESS,
                DRAGONX_ADDRESS
            );
    }

    /**
     * @dev Determines the WETH amount available for the next call to buyAndBurnDragonX.
     * This amount may be capped by a predefined limit `capPerSwap`.
     *
     * @notice Provides the amount of WETH to be used in the next TitanX purchase.
     *
     * @return forBuy The amount of WETH available for the next buy, possibly subject to a cap.
     * If the balance exceeds `capPerSwap`, `forBuy` is set to `capPerSwap`.
     */
    function wethForNextBuyAndBurn() public view returns (uint256 forBuy) {
        IERC20 weth = IERC20(WETH9_ADDRESS);
        forBuy = weth.balanceOf(address(this));
        if (forBuy > capPerSwap) {
            forBuy = capPerSwap;
        }
    }

    /**
     * Calculate Minimum Amount Out for Multi-hop Swap
     * @notice Calculates the minimum amount of DragonX tokens expected from a multi-hop swap starting with WETH.
     * Slippage is simplifed and applied as a constant parameter across both swaps.
     * @dev This function calculates the minimum amount of DragonX tokens that should be received when swapping a given
     *      amount of WETH for TitanX and then swapping TitanX for DragonX, considering a specified slippage.
     *      It involves the following steps:
     *        1. Get a quote for TitanX with the given WETH amount.
     *        2. Adjust the TitanX amount for slippage.
     *        3. Get a quote for DragonX with the adjusted TitanX amount.
     *        4. Adjust the DragonX amount for slippage to get the minimum amount out.
     * @param amountIn The amount of WETH to be swapped.
     * @return amountOutMinimum The minimum amount of DragonX tokens expected from the swap.
     */
    function calculateMinimumDragonAmount(
        uint256 amountIn
    ) public view returns (uint256) {
        // Ensure slippage is defined and accessible here, e.g., as a state variable

        // Calculate the expected amount of TITAN for the given amount of ETH
        uint256 expectedTitanAmount = getTitanQuoteForEth(amountIn);

        // Adjust for slippage (applied uniformly across both hops)
        uint256 adjustedTitanAmount = (expectedTitanAmount * (100 - slippage)) /
            100;

        // Calculate the expected amount of DRAGON for the adjusted amount of TITAN
        uint256 expectedDragonAmount = getDragonQuoteForTitan(
            adjustedTitanAmount
        );

        // Adjust for slippage again
        uint256 amountOutMinimum = (expectedDragonAmount * (100 - slippage)) /
            100;

        return amountOutMinimum;
    }

    // -----------------------------------------
    // Internal functions
    // -----------------------------------------

    // -----------------------------------------
    // Private functions
    // -----------------------------------------
    /**
     * @notice Sorts tokens in ascending order, as required by Uniswap for identifying a pair.
     * @dev This function arranges the token addresses in ascending order and assigns equal liquidity to both tokens.
     * @param initialLiquidityAmount The amount of liquidity to assign to each token.
     * @return token0 The token address that is numerically smaller.
     * @return token1 The token address that is numerically larger.
     * @return amount0 The liquidity amount for `token0`.
     * @return amount1 The liquidity amount for `token1`.
     */
    function _getTokenConfig(
        uint256 initialLiquidityAmount
    )
        private
        view
        returns (
            address token0,
            address token1,
            uint256 amount0,
            uint256 amount1
        )
    {
        token0 = TITANX_ADDRESS;
        token1 = DRAGONX_ADDRESS;
        amount0 = initialLiquidityAmount;
        amount1 = initialLiquidityAmount;
        if (DRAGONX_ADDRESS < TITANX_ADDRESS) {
            token0 = DRAGONX_ADDRESS;
            token1 = TITANX_ADDRESS;
        }
    }

    /**
     * @notice Creates a liquidity pool with a preset square root price ratio.
     * @dev This function initializes a Uniswap V3 pool with the specified initial liquidity amount.
     * @param initialLiquidityAmount The amount of liquidity to use for initializing the pool.
     */
    function _createPool(uint256 initialLiquidityAmount) private {
        (address token0, address token1, , ) = _getTokenConfig(
            initialLiquidityAmount
        );
        INonfungiblePositionManager manager = INonfungiblePositionManager(
            UNI_NONFUNGIBLEPOSITIONMANAGER
        );

        dragonTitanPoolAddress = manager.createAndInitializePoolIfNecessary(
            token0,
            token1,
            FEE_TIER,
            INITIAL_SQRT_PRICE_TITANX_DRAGONX
        );

        // Increase cardinality for observations enabling TWAP
        IUniswapV3Pool(dragonTitanPoolAddress)
            .increaseObservationCardinalityNext(100);
    }

    /**
     * @notice Mints a full range liquidity provider (LP) token in the Uniswap V3 pool.
     * @dev This function mints an LP token with the full price range in the Uniswap V3 pool.
     * @param initialLiquidityAmount The amount of liquidity to be used for minting the position.
     */
    function _mintInitialPosition(uint256 initialLiquidityAmount) private {
        INonfungiblePositionManager manager = INonfungiblePositionManager(
            UNI_NONFUNGIBLEPOSITIONMANAGER
        );

        (
            address token0,
            address token1,
            uint256 amount0Desired,
            uint256 amount1Desired
        ) = _getTokenConfig(initialLiquidityAmount);

        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: FEE_TIER,
                tickLower: MIN_TICK,
                tickUpper: MAX_TICK,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: (amount0Desired * 90) / 100,
                amount1Min: (amount1Desired * 90) / 100,
                recipient: address(this),
                deadline: block.timestamp + 600
            });

        (uint256 tokenId, uint256 liquidity, , ) = manager.mint(params);

        _tokenInfo.tokenId = uint80(tokenId);
        _tokenInfo.liquidity = uint128(liquidity);
        _tokenInfo.tickLower = MIN_TICK;
        _tokenInfo.tickUpper = MAX_TICK;
    }

    /**
     * @notice Collects liquidity pool fees from the Uniswap V3 pool.
     * @dev This function calls the Uniswap V3 `collect` function to retrieve LP fees.
     * @return amount0 The amount of `token0` collected as fees.
     * @return amount1 The amount of `token1` collected as fees.
     */
    function _collectFees() private returns (uint256 amount0, uint256 amount1) {
        INonfungiblePositionManager manager = INonfungiblePositionManager(
            UNI_NONFUNGIBLEPOSITIONMANAGER
        );

        INonfungiblePositionManager.CollectParams
            memory params = INonfungiblePositionManager.CollectParams(
                _tokenInfo.tokenId,
                address(this),
                type(uint128).max,
                type(uint128).max
            );

        (amount0, amount1) = manager.collect(params);
    }
}
