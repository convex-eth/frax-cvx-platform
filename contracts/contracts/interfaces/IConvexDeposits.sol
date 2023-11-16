// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IConvexDeposits {
    function deposit(uint256 _pid, uint256 _amount, bool _stake) external returns(bool);
    function deposit(uint256 _amount, bool _lock, address _stakeAddress) external;
    function earmarkRewards(uint256 _pid) external returns(bool);
    function earmarkFees() external returns(bool);
}