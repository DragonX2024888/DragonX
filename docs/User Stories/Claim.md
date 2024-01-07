### User Story: Claiming ETH Rewards and Distributing According to Predefined Shares

#### Title: Reward Claim and Distribution Process in DragonX Ecosystem

#### Description
As a participant in the DragonX ecosystem, I want to use the `claim` function to claim ETH rewards derived from the TitanX stakes hold by DragonX. This function should ensure that the claimed rewards are allocated and distributed according to predefined shares to buy TitanX and to buy and burn DragonX, contributing to the ecosystem's sustainability and rewarding active participants.

#### Requirements
- **Preconditions**: The function must ensure:
  - The DragonX Buy and Burn contract is properly configured.
  - The TitanX Buy contract is set up correctly.

- **Process Flow**:
  1. **Configuration Validation**: Verify that the required contracts for DragonX Buy and Burn and TitanX Buy are properly set up.
  2. **ETH Reward Retrieval**: Aggregate the claimable ETH amount from all DragonStake contracts.
  3. **ETH Availability Check**: Confirm that there is a claimable amount of ETH; revert the transaction if none is available.
  4. **Reward Distribution Calculations**: 
     - Calculate the genesis share (8%) for the development team.
     - Determine the incentive fee (3%) to be sent as a tip to the function caller.
     - Allocate 44.5% of the ETH for buying and burning DragonX tokens.
     - Allocate the remaining 44.5% for buying and burning TitanX tokens.
  5. **Vault Updates and Fund Transfers**: 
     - Update the genesis vault with its allocated share.
     - Send the calculated amounts to the respective Buy and Burn contracts.
     - Transfer the incentive fee to the caller of the function.
  6. **State Update and Event Emission**: 
     - Update the total ETH claimed state variable.
     - Emit a `Claimed` event with details of the claimed amount, shares allocated, and the caller's address.

#### Acceptance Criteria
- The function should execute only if the preconditions are met.
- The claimed ETH amount should be accurately aggregated from the stake contracts.
- Reward distribution should adhere to the predefined shares, ensuring fair allocation to the genesis team, Buy and Burn contracts, and the function caller.
- The vaults and state variables should be updated accurately to reflect the new allocations.
- The incentive fee must be correctly transferred to the function caller.
- The function should emit the `Claimed` event with detailed and accurate information.
- The process should be secure, particularly in handling ETH transfers and preventing reentrancy attacks.
