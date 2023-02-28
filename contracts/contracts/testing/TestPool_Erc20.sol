// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract TestPool_Erc20 {
    using SafeERC20 for IERC20;
    /* ========== STATE VARIABLES ========== */

    IERC20 public stakingToken;

    // Stake tracking
    mapping(address => LockedStake[]) public lockedStakes;

    uint256 public _total_liquidity_locked;
    mapping(address => uint256) _locked_liquidity;
    address[] internal rewardTokens;
    address public owner;

    /* ========== STRUCTS ========== */

    // Struct for the stake
    struct LockedStake {
        bytes32 kek_id;
        uint256 start_timestamp;
        uint256 liquidity;
        uint256 ending_timestamp;
        uint256 lock_multiplier; // 6 decimals of precision. 1x = 1000000
    }
    
    /* ========== CONSTRUCTOR ========== */

    constructor (
        address _stakeToken
    ){
        owner = msg.sender;
        stakingToken = IERC20(_stakeToken);
        rewardTokens = [0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0];
    }

    /* ============= VIEWS ============= */

    function getAllRewardTokens() external view returns (address[] memory) {
        return rewardTokens;
    }
    function earned(address ) external view returns(uint256[] memory new_earned){
        new_earned = new uint256[](rewardTokens.length);
    }
    function veFXSMultiplier(address ) external pure returns(uint256){
        return 0;
    }
    function totalCombinedWeight() external view returns(uint256){
        return _total_liquidity_locked;
    }
    function combinedWeightOf(address account) external view returns(uint256){
        return _locked_liquidity[account];
    }
    // ------ LOCK RELATED ------

    // Return all of the locked NFT positions
    function lockedStakesOf(address account) external view returns (LockedStake[] memory) {
        return lockedStakes[account];
    }

    // Returns the length of the locked NFTs for a given account
    function lockedStakesOfLength(address account) external view returns (uint256) {
        return lockedStakes[account].length;
    }

    function lockedLiquidityOf(address account) external view returns(uint256){
        return _locked_liquidity[account];
    }


    /* =============== MUTATIVE FUNCTIONS =============== */

     function _getStake(address staker_address, bytes32 kek_id) internal view returns (LockedStake memory locked_stake, uint256 arr_idx) {
        for (uint256 i = 0; i < lockedStakes[staker_address].length; i++){ 
            if (kek_id == lockedStakes[staker_address][i].kek_id){
                locked_stake = lockedStakes[staker_address][i];
                arr_idx = i;
                break;
            }
        }
        require(locked_stake.kek_id == kek_id, "Stake not found");
        
    }

    // Add additional LPs to an existing locked stake
    function lockAdditional(bytes32 kek_id, uint256 addl_liq) public {
        // Get the stake and its index
        (LockedStake memory thisStake, uint256 theArrayIndex) = _getStake(msg.sender, kek_id);

        // Calculate the new amount
        uint256 new_amt = thisStake.liquidity + addl_liq;

        // Checks
        require(addl_liq >= 0, "Must be nonzero");

        // Pull the tokens from the sender
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), addl_liq);

        // Update the stake
        lockedStakes[msg.sender][theArrayIndex] = LockedStake(
            kek_id,
            thisStake.start_timestamp,
            new_amt,
            thisStake.ending_timestamp,
            thisStake.lock_multiplier
        );

        // Update liquidities
        _total_liquidity_locked += addl_liq;
        _locked_liquidity[msg.sender] += addl_liq;
        // {
        //     address the_proxy = staker_designated_proxies[msg.sender];
        //     if (the_proxy != address(0)) proxy_lp_balances[the_proxy] += addl_liq;
        // }

        // Need to call to update the combined weights
        // _updateRewardAndBalance(msg.sender, false);
    }

    // Two different stake functions are needed because of delegateCall and msg.sender issues (important for migration)
    function stakeLocked(uint256 token_id, uint256 secs) external {
        _stakeLocked(msg.sender, msg.sender, token_id, secs, block.timestamp);
    }

    // If this were not internal, and source_address had an infinite approve, this could be exploitable
    // (pull funds from source_address and stake for an arbitrary staker_address)
    function _stakeLocked(
        address staker_address,
        address source_address,
        uint256 liquidity,
        uint256 secs,
        uint256 start_timestamp
    ) internal {
        // require(stakingPaused == false || valid_migrators[msg.sender] == true, "Staking paused or in migration");
        // require(secs >= lock_time_min, "Minimum stake time not met");
        // require(secs <= lock_time_for_max_multiplier,"Trying to lock for too long");

        // Pull in the required token(s)
        // Varies per farm
        IERC20(stakingToken).safeTransferFrom( source_address, address(this), liquidity);

        // Get the lock multiplier and kek_id
        uint256 lock_multiplier = 1e18;//lockMultiplier(secs);
        bytes32 kek_id = keccak256(abi.encodePacked(staker_address, start_timestamp, liquidity, _locked_liquidity[staker_address]));
        
        // Create the locked stake
        lockedStakes[staker_address].push(LockedStake(
            kek_id,
            start_timestamp,
            liquidity,
            start_timestamp + secs,
            lock_multiplier
        ));

        // Update liquidities
        _total_liquidity_locked += liquidity;
        _locked_liquidity[staker_address] += liquidity;
        // {
        //     address the_proxy = staker_designated_proxies[staker_address];
        //     if (the_proxy != address(0)) proxy_lp_balances[the_proxy] += liquidity;
        // }
        
        // Need to call again to make sure everything is correct
        // _updateRewardAndBalance(staker_address, false);

        // emit StakeLocked(staker_address, liquidity, secs, kek_id, source_address);
    }

    // ------ WITHDRAWING ------

    // Two different withdrawLocked functions are needed because of delegateCall and msg.sender issues (important for migration)
    function withdrawLocked(bytes32 kek_id, address destination_address) external {
        // require(withdrawalsPaused == false, "Withdrawals paused");
        _withdrawLocked(msg.sender, destination_address, kek_id);
    }

    // No withdrawer == msg.sender check needed since this is only internally callable and the checks are done in the wrapper
    // functions like migrator_withdraw_locked() and withdrawLocked()
    function _withdrawLocked(
        address staker_address,
        address destination_address,
        bytes32 kek_id
    ) internal {
        // Collect rewards first and then update the balances
        // _getReward(staker_address, destination_address);

        // Get the stake and its index
        (LockedStake memory thisStake, uint256 theArrayIndex) = _getStake(staker_address, kek_id);
        require(block.timestamp >= thisStake.ending_timestamp, "Stake is still locked!");
        uint256 liquidity = thisStake.liquidity;

        if (liquidity > 0) {
            // Update liquidities
            _total_liquidity_locked = _total_liquidity_locked - liquidity;
            _locked_liquidity[staker_address] = _locked_liquidity[staker_address] - liquidity;
            // {
            //     address the_proxy = staker_designated_proxies[staker_address];
            //     if (the_proxy != address(0)) proxy_lp_balances[the_proxy] -= liquidity;
            // }

            // Remove the stake from the array
            delete lockedStakes[staker_address][theArrayIndex];

            // Give the tokens to the destination_address
            // Should throw if insufficient balance
            stakingToken.transfer(destination_address, liquidity);

            // Need to call again to make sure everything is correct
            // _updateRewardAndBalance(staker_address, false);

            // emit WithdrawLocked(staker_address, liquidity, kek_id, destination_address);
        }
    }

    function getReward(address ) external pure returns (uint256[] memory _reward){
        _reward = new uint256[](1);
    }

    function getReward(address , bool ) external pure returns (uint256[] memory _reward){
        _reward = new uint256[](1);
    }

    function proxyToggleStaker(address staker) external{

    }

    function stakerSetVeFXSProxy(address proxy) external{

    }

    function toggleValidVeFXSProxy(address _proxy) external{

    }

    // event WithdrawLocked(address indexed user, uint256 liquidity, uint256 token_id, address destination_address);
}