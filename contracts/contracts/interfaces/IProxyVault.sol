// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IProxyVault {
    function initialize(address _owner, address _feeRegistry, address _stakingAddress, address _stakingToken) external;
}