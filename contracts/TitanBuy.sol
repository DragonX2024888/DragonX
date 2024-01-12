// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// UniSwap
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

// OpenZeppelins
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Library
import "./lib/Constants.sol";
import "./lib/interfaces/IWETH.sol";
import "./lib/uniswap/PoolAddress.sol";
import "./lib/uniswap/Oracle.sol";
import "./lib/uniswap/TickMath.sol";

// Other
import "./DragonX.sol";

contract TitanBuy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeERC20 for IWETH9;

    // -----------------------------------------
    // Type declarations
    // -----------------------------------------

    // -----------------------------------------
    // State variables
    // -----------------------------------------
    /**
     * @dev The address of the DragonX Contract.
     */
    address public DRAGONX_ADDRESS;

    /**
     * @dev Maximum slippage percentage acceptable when buying TitanX with WETH.
     * Slippage is expressed as a percentage (e.g., 5 for 5% slippage).
     */
    uint256 public slippage;

    /**
     * @dev Tracks the total amount of WETH used for purchasing TitanX tokens.
     * This accumulates the WETH spent over time in buy transactions.
     */
    uint256 public totalWethUsedForBuys;

    /**
     * @dev Tracks the total amount of TitanX tokens purchased and burned.
     * This accumulates the TitanX bought and subsequently burned over time.
     */
    uint256 public totalTitanBought;

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
     * @dev Specifies the value in minutes for the timed-weighted average when calculating the TitanX price (in WETH)
     * for slippage protection.
     */
    uint32 private _titanPriceTwa;

    // -----------------------------------------
    // Errors
    // -----------------------------------------
    /**
     * @dev Thrown when the provided address is address(0)
     */
    error InvalidDragonAddress();

    /**
     * @dev Thrown when the transfer of TitanX tokens fails.
     */
    error TitanTransferFailed();

    /**
     * @dev Thrown when the function caller is not authorized or expected.
     */
    error InvalidCaller();

    /**
     * @dev Thrown when trying to buy TitanX but the cooldown period is still active.
     */
    error CooldownPeriodActive();

    /**
     * @dev Thrown when trying to buy TitanX but there is no WETH in the contract.
     */
    error NoWethToBuyTitan();

    /**
     * @dev Thrown when trying to get Titan Price TWA data but there is none
     */
    error NoTitanPriceTwaData();

    // -----------------------------------------
    // Events
    // -----------------------------------------
    /**
     * @notice Emitted when Titan tokens are purchased.
     * @param weth The amount of WETH used for the purchase.
     * @param titan The amount of Titan tokens bought.
     * @param caller The address of the caller who initiated the transaction.
     */
    event TitanBought(
        uint256 indexed weth,
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
     *      - Sets `_dragonPriceTwa` to 15 minutes, establishing a protection against sandwich-attacks.
     */
    constructor() Ownable(msg.sender) {
        // Set the cap for each swap to 1 ETH
        capPerSwap = 1 ether;
        // Set the maximum slippage to 5%
        slippage = 5;
        // Set the minimum interval between buy and burn calls to 15 minutes
        interval = 15 * 60;
        // Set TWA to 15 mins
        _titanPriceTwa = 15;
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
     * @notice Executes a swap of WETH for TitanX tokens, applies incentive fees, and updates relevant contracts and state.
     * @dev This function:
     *      1. Checks for valid DragonX address.
     *      2. Ensures the caller is not a contract to prevent bot interactions.
     *      3. Enforces a cooldown period between successive calls.
     *      4. Calculates the WETH amount to be used for the swap based on the contract's WETH balance and cap per swap.
     *      5. Deducts an incentive fee from the WETH amount.
     *      6. Approves the swap router to spend WETH.
     *      7. Calculates the minimum amount of TitanX to be received in the swap, accounting for slippage.
     *      8. Performs the swap via the swap router.
     *      9. Transfers the bought TitanX tokens to the DragonX contract.
     *      10. Updates the DragonX vault.
     *      11. Updates state variables tracking WETH used and TitanX bought.
     *      12. Sends the incentive fee to the message sender.
     *      13. Emits a `TitanBought` event.
     * @return amountOut The amount of TitanX tokens bought in the swap.
     * @custom:revert InvalidDragonAddress If the DragonX address is not set.
     * @custom:revert InvalidCaller If the function caller is a contract.
     * @custom:revert CooldownPeriodActive If the function is called again before the cooldown period has elapsed.
     * @custom:revert NoWethToBuyTitan If there is no WETH available to buy TitanX after deducting the incentive fee.
     */
    function buyTitanX() external nonReentrant returns (uint256 amountOut) {
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
            revert NoWethToBuyTitan();
        }

        // Approve the router to spend WETH
        weth.safeIncreaseAllowance(address(swapRouter), amountIn);

        // The minimum amount to receive
        uint256 amountOutMinimum = calculateMinimumTitanAmount(amountIn);

        // Swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: WETH9_ADDRESS,
                tokenOut: TITANX_ADDRESS,
                fee: FEE_TIER,
                recipient: address(this),
                deadline: block.timestamp + 1,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

        // Execute the swap
        amountOut = swapRouter.exactInputSingle(params);

        // Transfer the bought TitanX to DragonX
        IERC20(TITANX_ADDRESS).safeTransfer(DRAGONX_ADDRESS, amountOut);

        // Update DragonX vault
        DragonX(payable(DRAGONX_ADDRESS)).updateVault();

        // Update state
        totalWethUsedForBuys += amountIn;
        totalTitanBought += amountOut;

        // Send incentive fee
        Address.sendValue(payable(_msgSender()), incentiveFee);

        // Emit events
        emit TitanBought(amountIn, amountOut, msg.sender);
    }

    /**
     * @dev Retrieves the total amount of Wrapped Ethereum (WETH) available to buy TitanX.
     * This function queries the balance of WETH held by the contract itself.
     *
     * @notice Use this function to get the total WETH available for purchasing TitanX.
     *
     * @return balance The total amount of WETH available, represented as a uint256.
     */
    function totalWethForBuy() external view returns (uint256 balance) {
        return IERC20(WETH9_ADDRESS).balanceOf(address(this));
    }

    /**
     * @dev Calculates the incentive fee for executing the buyTitanX function.
     * The fee is computed based on the WETH amount designated for the next TitanX purchase,
     * using the `wethForNextBuy` function, and applying a predefined incentive fee rate.
     *
     * @notice Used to determine the incentive fee for running the buyTitanX function.
     *
     * @return fee The calculated incentive fee, represented as a uint256.
     * This value is calculated by taking the product of `wethForNextBuy()` and
     * `INCENTIVE_FEE`, then dividing by `BASIS` to normalize the fee calculation.
     */
    function incentiveFeeForRunningBuyTitanX()
        external
        view
        returns (uint256 fee)
    {
        uint256 forBuy = wethForNextBuy();
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
     * Calculate Minimum Amount Out for swapping WETH to TitanX
     * @notice Calculates the minimum amount of TitanX tokens expected from a single-hop swap starting with WETH.
     * @dev This function calculates the minimum amount of TitanX tokens that should be received when swapping a given
     *      amount of WETH for TitanX, considering a specified slippage.
     *      It involves the following steps:
     *        1. Get a quote for TitanX with the given WETH amount.
     *        2. Adjust the TitanX amount for slippage to get the minimum amount out.
     * @param amountIn The amount of WETH to be swapped.
     * @return amountOutMinimum The minimum amount of TitanX tokens expected from the swap.
     */
    function calculateMinimumTitanAmount(
        uint256 amountIn
    ) public view returns (uint256) {
        // Calculate the expected amount of TITAN for the given amount of ETH
        uint256 expectedTitanAmount = getTitanQuoteForEth(amountIn);

        // Adjust for slippage (applied uniformly across both hops)
        uint256 adjustedTitanAmount = (expectedTitanAmount * (100 - slippage)) /
            100;

        return adjustedTitanAmount;
    }

    /**
     * @dev Determines the WETH amount available for the next call to buyTitanX.
     * This amount may be capped by a predefined limit `capPerSwap`.
     *
     * @notice Provides the amount of WETH to be used in the next TitanX purchase.
     *
     * @return forBuy The amount of WETH available for the next buy, possibly subject to a cap.
     * If the balance exceeds `capPerSwap`, `forBuy` is set to `capPerSwap`.
     */
    function wethForNextBuy() public view returns (uint256 forBuy) {
        IERC20 weth = IERC20(WETH9_ADDRESS);
        forBuy = weth.balanceOf(address(this));
        if (forBuy > capPerSwap) {
            forBuy = capPerSwap;
        }
    }

    // -----------------------------------------
    // Internal functions
    // -----------------------------------------

    // -----------------------------------------
    // Private functions
    // -----------------------------------------
}
