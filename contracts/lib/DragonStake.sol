// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Library
import "./interfaces/ITitanX.sol";
import "../DragonX.sol";
import "./Constants.sol";

/**
 * @title A contract managed and deployed by DragonX to initialise the maximum amount of stakes per address
 * @author The DragonX devs
 * @notice This contract is instantiated by DragonX and will not be deployed as a separate entity
 */
contract DragonStake is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for ITitanX;

    // -----------------------------------------
    // Type declarations
    // -----------------------------------------

    // -----------------------------------------
    // State variables
    // -----------------------------------------
    uint256 public openedStakes;

    // -----------------------------------------
    // Errors
    // -----------------------------------------

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
    /**
     * @dev Receive function to handle plain Ether transfers.
     * Reverts if the sender is not the allowed address.
     */
    receive() external payable {
        require(msg.sender == TITANX_ADDRESS, "Sender not authorized");
    }

    // -----------------------------------------
    // Fallback function
    // -----------------------------------------
    /**
     * @dev Fallback function to handle non-function calls or Ether transfers if receive() doesn't exist.
     * Reverts if the sender is not the allowed address.
     */
    fallback() external payable {
        revert("Fallback triggered");
    }

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

    /**
     * @dev Ends a stake after it has reached its maturity.
     *
     * This function interacts with the ITitanX contract to handle stake operations.
     * It requires the stake ID (sId) to be valid and within the range of opened stakes.
     * If the current block timestamp is greater than or equal to the stake's maturity timestamp,
     * the function ends the stake and transfers the unstaked TitanX tokens to the DragonX contract.
     * If the stake has not yet matured, the function will revert.
     *
     * @param sId The ID of the stake to be ended.
     * @notice The function is callable externally and interacts with ITitanX and IERC20 contracts.
     * @notice It is required that the stake ID is valid and the stake is matured.
     * @notice The function will revert if the stake is not matured.
     */
    function endStakeAfterMaturity(uint256 sId) external {
        ITitanX titanX = ITitanX(TITANX_ADDRESS);
        require(sId > 0 && sId <= openedStakes, "invalid ID");

        UserStakeInfo memory stakeInfo = titanX.getUserStakeInfo(
            address(this),
            sId
        );

        // End stake if matured
        if (block.timestamp >= stakeInfo.maturityTs) {
            // track TitanX balance
            uint256 before = titanX.balanceOf(address(this));

            // End the stake
            titanX.endStake(sId);

            // Send total amount unstaked back to DragonX
            uint256 unstaked = titanX.balanceOf(address(this)) - before;

            // Transfer TitanX to DragonX
            IERC20(TITANX_ADDRESS).safeTransfer(owner(), unstaked);

            // Update DragonX
            DragonX(payable(owner())).stakeEnded(unstaked);
        } else {
            revert("not mature");
        }
    }

    /**
     * Send TitanX Balance to DragonX
     *
     * @dev This function transfers any TitanX tokens held by this contract to the owner,
     * representing the DragonX account. This is a safety mechanism to handle
     * rare situations where TitanX tokens are accidentally sent to this contract or are
     * left over from operations like calling `TitanX#endStakeForOthers`.
     *
     * It's important to note that this function could lead to slight discrepancies in
     * DragonX's accounting, specifically in the `totalTitanUnstaked` value - there is 
     * no way to distinguish between TitanX send to this contract by accident or
     * users calling `TitanX#endStakeForOthers`.
     *
     * @notice Use this function to transfer TitanX tokens from the contract to the DragonX
     * owner address in case of accidental transfers or calling `TitanX#endStakeForOthers`
     */
    function sendTitanX() external {
        IERC20 titanX = IERC20(TITANX_ADDRESS);

        // transfer
        titanX.safeTransfer(owner(), titanX.balanceOf(address(this)));

        // update the vault
        DragonX(payable(owner())).updateVault();
    }

    /**
     * @dev Calculates the total amount of Ethereum claimable by the contract.
     *      Calls `getUserETHClaimableTotal` from the TitanX contract to retrieve the total claimable amount.
     * @return claimable The total amount of Ethereum claimable by the contract.
     */
    function totalEthClaimable() external view returns (uint256 claimable) {
        // Initialize TitanX contract reference
        ITitanX titanX = ITitanX(TITANX_ADDRESS);

        claimable = titanX.getUserETHClaimableTotal(address(this));
    }

    /**
     * @dev Determines whether any of the stakes have reached their maturity date.
     *      Iterates through all user stakes and checks if the current block timestamp
     *      is at or past the stake's maturity timestamp.
     * @return A boolean indicating whether at least one stake has reached maturity.
     */
    function stakeReachedMaturity() external view returns (bool, uint256) {
        ITitanX titanX = ITitanX(TITANX_ADDRESS);
        UserStake[] memory stakes = titanX.getUserStakes(address(this));

        for (uint256 idx = 0; idx < stakes.length; idx++) {
            if (block.timestamp > stakes[idx].stakeInfo.maturityTs) {
                return (true, stakes[idx].sId);
            }
        }

        return (false, 0);
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
