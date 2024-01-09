// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.20;

/**
 * @notice Adapted Uniswap V3 pool address computation to be compliant with Solidity 0.8.x and later.
 * @dev Changes were made to address the stricter type conversion rules in newer Solidity versions.
 *      Original Uniswap V3 code directly converted a uint256 to an address, which is disallowed in Solidity 0.8.x.
 *      Adaptation Steps:
 *        1. The `pool` address is computed by first hashing pool parameters.
 *        2. The resulting `uint256` hash is then explicitly cast to `uint160` before casting to `address`.
 *           This two-step conversion process is necessary due to the Solidity 0.8.x restriction.
 *           Direct conversion from `uint256` to `address` is disallowed to prevent mistakes
 *           that can occur due to the size mismatch between the types.
 *        3. Added a require statement to ensure `token0` is less than `token1`, maintaining
 *           Uniswap's invariant and preventing pool address calculation errors.
 * @param factory The Uniswap V3 factory contract address.
 * @param key The PoolKey containing token addresses and fee tier.
 * @return pool The computed address of the Uniswap V3 pool.
 * @custom:modification Explicit type conversion from `uint256` to `uint160` then to `address`.
 *
 * function computeAddress(address factory, PoolKey memory key) internal pure returns (address pool) {
 *     require(key.token0 < key.token1);
 *     pool = address(
 *         uint160( // Explicit conversion to uint160 added for compatibility with Solidity 0.8.x
 *             uint256(
 *                 keccak256(
 *                     abi.encodePacked(
 *                         hex'ff',
 *                         factory,
 *                         keccak256(abi.encode(key.token0, key.token1, key.fee)),
 *                         POOL_INIT_CODE_HASH
 *                     )
 *                 )
 *             )
 *         )
 *     );
 * }
 */

/// @dev This code is copied from Uniswap V3 which uses an older compiler version.
/// @title Provides functions for deriving a pool address from the factory, tokens, and the fee
library PoolAddress {
    bytes32 internal constant POOL_INIT_CODE_HASH =
        0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54;

    /// @notice The identifying key of the pool
    struct PoolKey {
        address token0;
        address token1;
        uint24 fee;
    }

    /// @notice Returns PoolKey: the ordered tokens with the matched fee levels
    /// @param tokenA The first token of a pool, unsorted
    /// @param tokenB The second token of a pool, unsorted
    /// @param fee The fee level of the pool
    /// @return Poolkey The pool details with ordered token0 and token1 assignments
    function getPoolKey(
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal pure returns (PoolKey memory) {
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        return PoolKey({token0: tokenA, token1: tokenB, fee: fee});
    }

    /// @notice Deterministically computes the pool address given the factory and PoolKey
    /// @param factory The Uniswap V3 factory contract address
    /// @param key The PoolKey
    /// @return pool The contract address of the V3 pool
    function computeAddress(
        address factory,
        PoolKey memory key
    ) internal pure returns (address pool) {
        require(key.token0 < key.token1);
        pool = address(
            uint160( // Convert uint256 to uint160 first
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            factory,
                            keccak256(
                                abi.encode(key.token0, key.token1, key.fee)
                            ),
                            POOL_INIT_CODE_HASH
                        )
                    )
                )
            )
        );
    }
}
