// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IGovDelegation{
    function delegates(address delegator) external view returns (address delegateAddress);
    function delegate(address delegatee) external;
}