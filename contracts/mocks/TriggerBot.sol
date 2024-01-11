// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// Library
import "../TitanBuy.sol";
import "../DragonBuyAndBurn.sol";
import "../DragonX.sol";

// A simple contract to buy TitanX within the test environment
contract TriggerBot {
    function triggerBuyTitan(address payable titanBuyAddress) external {
        TitanBuy(titanBuyAddress).buyTitanX();
    }

    function triggerDragonBuyAndBurn(address payable titanBuyAddress) external {
        DragonBuyAndBurn(titanBuyAddress).buyAndBurnDragonX();
    }

    function triggerClaim(address payable dragonAddress) external {
        DragonX(dragonAddress).claim();
    }
}
