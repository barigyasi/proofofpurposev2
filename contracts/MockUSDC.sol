// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice 6-decimal ERC20 for local Remix VM / testnet use. Anyone can mint
 *         to any address — DO NOT deploy to mainnet.
 *
 * Constructor mints `initialSupply` (in whole USDC units, e.g. 1_000_000 = 1M USDC)
 * to the deployer for convenience.
 */
contract MockUSDC is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock USD Coin", "USDC") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Faucet — anyone can mint to anyone. Test-only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Convenience: mint whole-USDC units (e.g. 1000 => 1000 USDC).
    function mintUnits(address to, uint256 wholeUsdc) external {
        _mint(to, wholeUsdc * 10 ** decimals());
    }
}
