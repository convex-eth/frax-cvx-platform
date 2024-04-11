// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IFraxtalVoteEscrow {
    function lockedById(address _addr, uint256 _id) external view returns (int128 _amount, uint128 _end);
    function lockedByIndex(address _addr, uint128 _index) external view returns (int128 _amount, uint128 _end);
    function lockedEnd(address _addr, uint128 _index) external view returns (uint256);
    function getLockIndexById(address _addr, uint256 _id) external view returns (uint128 _index);
    function createLock(address _addr, uint256 _value,uint128 _unlockTime) external returns (uint128 _index, uint256 _newLockId);
    function depositFor(address _addr, uint256 _value, uint128 _lockIndex) external;
    function increaseAmount(uint256 _value, uint128 _lockIndex) external;
    function increaseUnlockTime(uint128 _unlockTime, uint128 _lockIndex) external;
    function withdraw(uint128 _lockIndex) external returns (uint256 _value);
    function checkpoint() external;
}