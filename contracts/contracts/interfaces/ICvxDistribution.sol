// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ICvxDistribution{
    function earned(address _account) external view returns (uint256);
    function getReward(address _forward) external;
    function setWeight(address _account, uint256 _amount) external returns(bool);
    function setWeights(address[] calldata _account, uint256[] calldata _amount) external;
}