// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IApprovedReceivers {
    function check(address _wallet) external view returns (uint256);
}