// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IConvexVault {

    function stakeLockedCurveLp(uint256 _liquidity, uint256 _secs) external returns (bytes32 kek_id);
    function stakeLockedConvexToken(uint256 _liquidity, uint256 _secs) external returns (bytes32 kek_id);
    function stakeLocked(uint256 _liquidity, uint256 _secs) external returns (bytes32 kek_id);
    function lockAdditional(bytes32 _kek_id, uint256 _addl_liq) external;
    function lockAdditionalCurveLp(bytes32 _kek_id, uint256 _addl_liq) external;
    function lockAdditionalConvexToken(bytes32 _kek_id, uint256 _addl_liq) external;
    function lockLonger(bytes32 _kek_id, uint256 new_ending_ts) external;
    function withdrawLocked(bytes32 _kek_id) external;
    function withdrawLockedAndUnwrap(bytes32 _kek_id) external;
    function getReward() external;
    function getReward(bool _claim, address[] calldata _rewardTokenList) external;
}