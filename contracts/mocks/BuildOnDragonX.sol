// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

// Library
import "../DragonX.sol";
import "../lib/interfaces/ITitanX.sol";
import "../lib/Constants.sol";

// Simulating a protocol which contributes to the TitanX vault
contract BuildOnDragonX {
    function sendToDragonVault(address dragonAddress) external {
        DragonX dragonX = DragonX(payable(dragonAddress));
        ITitanX titanX = ITitanX(TITANX_ADDRESS);

        // Transfer TitanX hold by this contract to DragonX
        titanX.transfer(dragonAddress, titanX.balanceOf(address(this)));

        // Update the DragonX vault
        dragonX.updateVault();
    }
}
