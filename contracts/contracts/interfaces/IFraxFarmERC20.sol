// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IFraxFarmERC20 {
    
    struct LockedStake {
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier;
    }

    function owner() external view returns (address);
    function stakingToken() external view returns (address);
    function fraxPerLPToken() external view returns (uint256);
    function calcCurCombinedWeight(address account) external view
        returns (
            uint256 old_combined_weight,
            uint256 new_vefxs_multiplier,
            uint256 new_combined_weight
        );
    
    // stake management & getters
    function getStakeLiquidityAndEnding(address staker, uint256 locked_stake_index) external view returns (uint256,uint256);
    function lockedStakesOf(address account) external view returns (LockedStake[] memory);
    function lockedStakesOfLength(address account) external view returns (uint256);
    function manageStake(uint256 liquidity, uint256 secs, bool useTargetStakeIndex, uint256 targetIndex) external returns (uint256);
    function withdrawLocked(uint256 lockId, address destination_address) external returns (uint256);

    // stake transfer functions
    function setAllowance(address spender, uint256 lockId, uint256 amount) external;
    function increaseAllowance(address spender, uint256 lockId, uint256 amount) external;
    function removeAllowance(address spender, uint256 lockId) external;
    function setApprovalForAll(address spender, bool approved) external;
    function transferLocked(address receiver_address, uint256 sender_lock_index, uint256 transfer_amount, bool use_receiver_lock_index, uint256 receiver_lock_index) external returns(uint256,uint256);

    function periodFinish() external view returns (uint256);
    function rewardsDuration() external view returns (uint256);
    function getAllRewardTokens() external view returns (address[] memory);
    function earned(address account) external view returns (uint256[] memory new_earned);
    function totalLiquidityLocked() external view returns (uint256);
    function lockedLiquidityOf(address account) external view returns (uint256);
    function totalCombinedWeight() external view returns (uint256);
    function combinedWeightOf(address account) external view returns (uint256);
    function lockMultiplier(uint256 secs) external view returns (uint256);
    function rewardRates(uint256 token_idx) external view returns (uint256 rwd_rate);

    function userStakedFrax(address account) external view returns (uint256);
    function proxyStakedFrax(address proxy_address) external view returns (uint256);
    function maxLPForMaxBoost(address account) external view returns (uint256);
    function minVeFXSForMaxBoost(address account) external view returns (uint256);
    function minVeFXSForMaxBoostProxy(address proxy_address) external view returns (uint256);
    function veFXSMultiplier(address account) external view returns (uint256 vefxs_multiplier);

    function toggleValidVeFXSProxy(address proxy_address) external;
    function proxyToggleStaker(address staker_address) external;
    function stakerSetVeFXSProxy(address proxy_address) external;
    function getReward(address destination_address) external returns (uint256[] memory);
    function vefxs_max_multiplier() external view returns(uint256);
    function vefxs_boost_scale_factor() external view returns(uint256);
    function vefxs_per_frax_for_max_boost() external view returns(uint256);
    function getProxyFor(address addr) external view returns (address);
    function setRewardVars(address reward_token_address, uint256 _new_rate, address _gauge_controller_address, address _rewards_distributor_address) external;

    function sync() external;
}
