// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// UniSwap
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoterV2.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

// OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Library
import "../lib/Constants.sol";
import "../lib/interfaces/IWETH.sol";

// A simple contract to help with swaps in the test environment
contract SwapHelper {
    // Function to swap TitanX to DragonX
    function swapTitanToDragon(
        uint256 amountIn,
        address dragonAddress
    ) external returns (uint256 amountOut) {
        ISwapRouter swapRouter = ISwapRouter(UNI_SWAP_ROUTER);
        // Transfer TitanX to this contract
        IERC20(TITANX_ADDRESS).transferFrom(
            msg.sender,
            address(this),
            amountIn
        );

        // Approve the router to spend TitanX
        TransferHelper.safeApprove(
            TITANX_ADDRESS,
            address(swapRouter),
            amountIn
        );

        // Swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: TITANX_ADDRESS,
                tokenOut: dragonAddress,
                fee: FEE_TIER,
                recipient: address(this),
                deadline: block.timestamp + 1,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // Execute the swap
        amountOut = swapRouter.exactInputSingle(params);

        // Transfer TitanX to the function caller
        require(
            IERC20(dragonAddress).transfer(msg.sender, amountOut),
            "Transfer failed"
        );
    }

    // Function to swap ETH for TitanX
    function swapETHForTitanX() external payable returns (uint256 amountOut) {
        require(msg.value > 0, "Must send ETH");
        ISwapRouter swapRouter = ISwapRouter(UNI_SWAP_ROUTER);

        // Wrap ETH into WETH
        IWETH9(WETH9_ADDRESS).deposit{value: msg.value}();

        // Approve the router to spend WETH
        TransferHelper.safeApprove(
            WETH9_ADDRESS,
            address(swapRouter),
            msg.value
        );

        // Swap parameters
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: WETH9_ADDRESS,
                tokenOut: TITANX_ADDRESS,
                fee: FEE_TIER,
                recipient: address(this),
                deadline: block.timestamp + 1,
                amountIn: msg.value,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        // Execute the swap
        amountOut = swapRouter.exactInputSingle(params);

        // Transfer TitanX to the function caller
        require(
            IERC20(TITANX_ADDRESS).transfer(msg.sender, amountOut),
            "Transfer failed"
        );
    }
}
