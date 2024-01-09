// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Library
import "./interfaces/ITitanX.sol";
import "./Constants.sol";

import "hardhat/console.sol";

/**
 * @title A contract managed and deployed by DragonX to initialise the maximum amount of stakes per address
 * @author The DragonX devs
 * @notice This contract is instantiated by DragonX and will not be deployed as a separate entity
 */
contract DragonStake is Ownable {
    using SafeERC20 for IERC20;

    // -----------------------------------------
    // Type declarations
    // -----------------------------------------

    // -----------------------------------------
    // State variables
    // -----------------------------------------
    uint256 public openedStakes;

    // -----------------------------------------
    // Events
    // -----------------------------------------

    // -----------------------------------------
    // Modifiers
    // -----------------------------------------

    // -----------------------------------------
    // Constructor
    // -----------------------------------------
    constructor() Ownable(msg.sender) {}

    // -----------------------------------------
    // Receive function
    // -----------------------------------------

    // -----------------------------------------
    // Fallback function
    // -----------------------------------------

    // -----------------------------------------
    // External functions
    // -----------------------------------------
    /**
     * TitanX Staking Function
     * @notice Stakes all available TitanX tokens held by this contract.
     * @dev Initializes the TitanX contract, calculates the stakable balance, and opens a new stake.
     *      This function can only be called by the contract owner.
     */
    function stake() external onlyOwner {
        // Initialize TitanX contract reference
        ITitanX titanX = ITitanX(TITANX_ADDRESS);

        // Fetch the current balance of TitanX tokens in this contract
        uint256 amountToStake = titanX.balanceOf(address(this));

        // Initiate staking of the fetched amount for the maximum defined stake length
        titanX.startStake(amountToStake, TITANX_MAX_STAKE_LENGTH);

        // Increment the count of active stakes
        openedStakes += 1;
    }

    /**
     * Claim ETH Rewards from TitanX Staking
     * @notice Allows the contract owner to claim accumulated ETH rewards from TitanX staking.
     * @dev Retrieves the total claimable ETH amount and, if any, claims it and sends it to the owner's address.
     *      This function can only be called by the contract owner.
     * @return claimable The total amount of ETH claimed.
     */
    function claim() external onlyOwner returns (uint256 claimable) {
        // Initialize TitanX contract reference
        ITitanX titanX = ITitanX(TITANX_ADDRESS);

        // Determine the total amount of ETH that can be claimed by this contract
        claimable = titanX.getUserETHClaimableTotal(address(this));

        // Proceed with claiming if there is any claimable ETH
        if (claimable > 0) {
            // Claim the available ETH from TitanX
            titanX.claimUserAvailableETHPayouts();

            // Transfer the claimed ETH to the contract owner
            Address.sendValue(payable(owner()), claimable);
        }
    }

    function totalEthClaimable() external view returns (uint256 claimable) {
        // Initialize TitanX contract reference
        ITitanX titanX = ITitanX(TITANX_ADDRESS);

        claimable = titanX.getUserETHClaimableTotal(address(this));
    }

    /**
     * @dev Receive function to handle plain Ether transfers.
     * Reverts if the sender is not the allowed address.
     */
    receive() external payable {
        require(msg.sender == TITANX_ADDRESS, "Sender not authorized");
    }

    /**
     * @dev Fallback function to handle non-function calls or Ether transfers if receive() doesn't exist.
     * Reverts if the sender is not the allowed address.
     */
    fallback() external payable {
        revert("Fallback triggered");
    }

    // -----------------------------------------
    // Public functions
    // -----------------------------------------

    // -----------------------------------------
    // Internal functions
    // -----------------------------------------

    // -----------------------------------------
    // Private functions
    // -----------------------------------------
}
