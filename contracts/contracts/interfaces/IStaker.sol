// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IStaker{
    function createLock(uint256, uint256) external;
    function increaseAmount(uint256) external;
    function increaseTime(uint256) external;
    function release() external;
    function checkpointFeeRewards(address) external;
    function claimFees(address,address,address) external;
    function voteGaugeWeight(address,uint256) external;
    function operator() external view returns (address);
    function execute(address _to, uint256 _value, bytes calldata _data) external returns (bool, bytes memory);
}