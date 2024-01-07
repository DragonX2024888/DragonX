### User Story: Minting DragonX Tokens in Exchange for TitanX

#### Title: Token Exchange and Minting Process within the DragonX Ecosystem

#### Description
As a user of the DragonX platform, I want to mint DragonX tokens by exchanging TitanX tokens during a specified minting phase. This process should ensure a fair allocation of tokens to the genesis address and maintain a balance of TitanX within the contract for future operations.

#### Requirements
- **Preconditions**: The function must ensure:
  - The initial liquidity has been minted, indicating the readiness of the entire contract system.
  - The current time falls within the active minting phase.
  - Users have sufficient TitanX balance and have granted enough allowance to the DragonX contract.

- **Process Flow**:
  1. **Minting Phase Validation**: Verify if the minting phase is currently active and the initial liquidity has been minted.
  2. **User Balance and Allowance Check**: Confirm that the user has enough TitanX tokens and has granted the necessary allowance.
  3. **TitanX Transfer**: Transfer the specified amount of TitanX from the user to the DragonX contract.
  4. **DragonX Token Minting**: Mint an equivalent amount of DragonX tokens for the user.
  5. **Genesis Share Calculation and Minting**: Calculate and mint the genesis share, which is 8% of the minted DragonX tokens.
  6. **Allocation to Genesis Vault**: Allocate the equivalent 8% share of both TitanX and DragonX to the genesis vault.
  7. **Retention of TitanX in Contract's Vault**: Store the remaining TitanX within the contract's vault for future use.

#### Acceptance Criteria
- The function should only execute if all preconditions are satisfied.
- TitanX tokens must be transferred successfully from the user to the DragonX contract.
- DragonX tokens must be minted accurately, reflecting the amount of TitanX exchanged.
- The genesis share of tokens must be accurately calculated and allocated to their vault.
- The remaining TitanX should be correctly retained in the contract's vault.
- The function should be secure, preventing potential exploits and ensuring fair participation for all users.
