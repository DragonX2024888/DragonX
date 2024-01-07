### User Story: Buy and Burn DragonX Tokens

#### Title: Automated Buy and Burn of DragonX Tokens

#### Description
As a user of the DragonX ecosystem, I want to be able to execute a function `buyAndBurnDragonX()` that allows for the automatic purchase and subsequent burning of DragonX tokens. This function will contribute to the stability and value of the DragonX tokens in the market. I want to receive an incentive fee for calling this function.

#### Requirements
- **Preconditions**: The function should only execute if certain conditions are met:
  - The DragonX address must be set and valid.
  - Only externally owned accounts (not contract accounts) should be able to call this function to prevent bot manipulation.
  - The function should enforce a cooldown period, ensuring a minimum gap between consecutive calls.
  - Sufficient WETH balance in the contract to facilitate the buy and burn process.

- **Process Flow**:
  1. **Validate Preconditions**: Check for a valid DragonX address, the type of caller, and the cooldown period.
  2. **Prepare for Token Swap**: Calculate the WETH amount to be used, considering the cap per swap and deducting the incentive fee.
  3. **Token Swap Execution**: Use a swap router to exchange WETH for DragonX tokens. The swap will follow a specified path and meet a minimum amount out criteria.
  4. **Token Burning**: Burn the acquired DragonX tokens.
  5. **State Update and Incentive Fee Handling**: Update the total WETH used and total Dragon burned, and send the incentive fee to the caller.
  6. **Event Emission**: Emit an event detailing the amounts of WETH used and DragonX burned, and the address of the caller.

#### Acceptance Criteria
- The function should revert transactions if any of the preconditions are not met.
- The WETH balance should be correctly calculated, and the incentive fee should be deducted and sent to the caller.
- The swap should be executed accurately with the specified parameters.
- DragonX tokens bought should be effectively burned.
- State variables (total WETH used and total Dragon burned) must be updated accurately.
- An event should be emitted with the correct details of the transaction.
- The function should be optimized for gas efficiency and security against potential exploits.
