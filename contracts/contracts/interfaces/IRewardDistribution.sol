// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IRewardDistribution{
    function getReward(address _claimTo) external returns(bool);
    function queueNewRewards(uint256 _rewards) external returns(bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address _account) external view returns (uint256);
}