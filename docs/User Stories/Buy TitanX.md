### User Story: Purchasing TitanX Tokens

#### Title: Automated Purchase of TitanX Tokens Using WETH

#### Description
As a participant in the DragonX ecosystem, I want to use the `buyTitanX()` function to automatically swap accumulated WETH for TitanX tokens. This function should not only perform the swap efficiently but also send me an incentive fee, update the DragonX vault, and maintain accurate record-keeping.

#### Requirements
- **Preconditions**: The function should be designed with the following checks:
  - A valid DragonX address must be set.
  - The function should be callable only by externally owned accounts (EOAs), not contracts, to prevent bot interactions.
  - A cooldown period should be enforced between successive calls to maintain orderly transactions.

- **Process Flow**:
  1. **Validating Preconditions**: Ensure the DragonX address is set, the caller is an EOA, and the cooldown period is observed.
  2. **Calculating WETH Amount for Swap**: Determine the amount of WETH available for the swap, respecting the cap per swap, and deducting the incentive fee.
  3. **Approving Swap Router**: Authorize the swap router to spend the calculated WETH amount.
  4. **Determining Minimum TitanX Amount**: Calculate the minimum amount of TitanX expected from the swap, considering slippage.
  5. **Executing the Swap**: Perform the swap through the swap router using specified parameters.
  6. **Transferring TitanX to DragonX**: After the swap, transfer the acquired TitanX tokens to the DragonX contract.
  7. **Updating DragonX Vault**: Reflect the changes in the DragonX vault for accurate record-keeping.
  8. **State Variable Updates**: Track and update the total WETH used for purchases and the total amount of TitanX bought.
  9. **Incentive Fee Distribution**: Send the incentive fee to the message sender as compensation.
  10. **Event Emission**: Emit a `TitanBought` event, detailing the WETH used, TitanX bought, and the caller's address.

#### Acceptance Criteria
- The function must only execute if all preconditions are satisfied.
- The WETH amount used for the swap should be accurately calculated, and the incentive fee correctly deducted.
- The swap should be conducted with precise execution, adhering to the minimum TitanX amount calculation.
- The transferred TitanX tokens should be accurately accounted for in the DragonX contract and vault.
- State variables should reflect the new totals of WETH used and TitanX bought.
- The incentive fee should be correctly sent to the caller.
- The `TitanBought` event should be emitted with accurate details of the transaction.
- The function should maintain high standards of security, particularly against reentrancy attacks.
