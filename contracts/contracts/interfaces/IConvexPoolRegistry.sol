// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IConvexPoolRegistry {
   function poolMapping(address _wrapper) external returns(uint256 _pid, address _lptoken, address _token, address _gauge, address _crvRewards);
}