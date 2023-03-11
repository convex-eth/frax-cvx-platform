// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IVaultRegistry{
    function activateUserVault(address _staker, address _vaultOwner, address _vault) external;
    function isVault(address _staker, address _vaultOwner, address _vault) external view returns (bool);
}