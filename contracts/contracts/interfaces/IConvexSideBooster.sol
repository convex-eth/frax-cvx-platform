// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IConvexSideBooster {
    function setTokenMinterOperator(address _token, address _minter, bool _active) external;
}