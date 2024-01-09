// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// OpenZeppelin
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Enum for stake status
enum StakeStatus {
    ACTIVE,
    ENDED,
    BURNED
}

// Struct for user stake information
struct UserStakeInfo {
    uint152 titanAmount;
    uint128 shares;
    uint16 numOfDays;
    uint48 stakeStartTs;
    uint48 maturityTs;
    StakeStatus status;
}

// Struct for user stake
struct UserStake {
    uint256 sId;
    uint256 globalStakeId;
    UserStakeInfo stakeInfo;
}

// Interface for the contract
interface IStakeInfo {
    /**
     * @notice Get all stake info of a given user address.
     * @param user The address of the user to query stake information for.
     * @return An array of UserStake structs containing all stake info for the given address.
     */
    function getUserStakes(
        address user
    ) external view returns (UserStake[] memory);
}

/**
 * @title The TitanX interface used by DragonX to manages stakes
 * @author The DragonX devs
 */
interface ITitanX is IERC20, IStakeInfo {
    /**
     * @notice Start a new stake
     * @param amount The amount of TitanX tokens to stake
     * @param numOfDays The length of the stake in days
     */
    function startStake(uint256 amount, uint256 numOfDays) external;

    /**
     * @notice Claims available ETH payouts for a user based on their shares in various cycles.
     * @dev This function calculates the total reward from different cycles and transfers it to the caller.
     */
    function claimUserAvailableETHPayouts() external;

    /**
     * @notice Calculates the total ETH claimable by a user for all cycles.
     * @dev This function sums up the rewards from various cycles based on user shares.
     * @param user The address of the user for whom to calculate the claimable ETH.
     * @return reward The total ETH reward claimable by the user.
     */
    function getUserETHClaimableTotal(
        address user
    ) external view returns (uint256 reward);

    /**
     * @notice Allows anyone to sync dailyUpdate manually.
     * @dev Function to be called for manually triggering the daily update process.
     * This function is public and can be called by any external entity.
     */
    function manualDailyUpdate() external;

    /**
     * @notice Trigger cycle payouts for days 8, 28, 90, 369, 888, including the burn reward cycle 28.
     * Payouts can be triggered on or after the maturity day of each cycle (e.g., Cycle8 on day 8).
     */
    function triggerPayouts() external;

    /**
     * @notice Create a new mint
     * @param mintPower The power of the mint, ranging from 1 to 100.
     * @param numOfDays The duration of the mint, ranging from 1 to 280 days.
     */
    function startMint(uint256 mintPower, uint256 numOfDays) external payable;

    /**
     * @notice Returns current mint cost
     * @return currentMintCost The current cost of minting.
     */
    function getCurrentMintCost() external view returns (uint256);
}
