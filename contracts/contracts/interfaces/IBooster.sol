// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IBooster {
   function addPool(address _implementation, address _stakingAddress, address _stakingToken) external;
   function deactivatePool(uint256 _pid) external;
   function setPoolRewardImplementation(address _impl) external;
   function setRewardActiveOnCreation(bool _active) external;
   function voteGaugeWeight(address _controller, address _gauge, uint256 _weight) external;
   function setDelegate(address _delegateContract, address _delegate, bytes32 _space) external;
   function owner() external returns(address);
   function rewardManager() external returns(address);
   function fxsDepositor() external returns(address);
   function isShutdown() external returns(bool);
   function createVault(uint256 _pid) external returns (address);
   function claimFees() external;
   function increaseAmount(uint256 _value, uint128 _lockIndex) external;
   function increaseUnlockTime(uint128 _unlockTime, uint128 _lockIndex) external;
   function increaseFpisAmount(uint256 _value, uint128 _lockIndex) external;
   function increaseFpisUnlockTime(uint128 _unlockTime, uint128 _lockIndex) external;
}