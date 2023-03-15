// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./StakingProxyBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/ICurveConvex.sol";
import "./interfaces/IConvexWrapperV2.sol";
import "./interfaces/IFraxFarmERC20.sol";


contract StakingProxyConvex is StakingProxyBase, ReentrancyGuard{
    using SafeERC20 for IERC20;

    address public constant convexCurveBooster = address(0xF403C135812408BFbE8713b5A23a04b3D48AAE31);
    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);

    address public curveLpToken;
    address public convexDepositToken;


    constructor() {
    }

    function vaultType() external pure override returns(VaultType){
        return VaultType.Convex;
    }

    function vaultVersion() external pure override returns(uint256){
        return 4;
    }

    //initialize vault 
    function initialize(address _owner, address _stakingAddress, address _stakingToken, address _rewardsAddress) external override{
        require(owner == address(0),"already init");

        //set variables
        owner = _owner;
        stakingAddress = _stakingAddress;
        stakingToken = _stakingToken;
        rewards = _rewardsAddress;

        //get tokens from pool info
        (address _lptoken, address _token,,, , ) = ICurveConvex(convexCurveBooster).poolInfo(IConvexWrapperV2(_stakingToken).convexPoolId());
    
        curveLpToken = _lptoken;
        convexDepositToken = _token;

        //set infinite approvals
        IERC20(_stakingToken).approve(_stakingAddress, type(uint256).max);
        IERC20(_lptoken).approve(_stakingToken, type(uint256).max);
        IERC20(_token).approve(_stakingToken, type(uint256).max);
    }

    //create a new locked state of _secs timelength with a Curve LP token
    function stakeLockedCurveLp(uint256 _liquidity, uint256 _secs, bool _useTargetStakeIndex, uint256 targetIndex) external onlyOwner nonReentrant returns (uint256 lockId){
        if(_liquidity > 0){
            //pull tokens from user
            IERC20(curveLpToken).safeTransferFrom(msg.sender, address(this), _liquidity);

            //deposit into wrapper
            IConvexWrapperV2(stakingToken).deposit(_liquidity, address(this));

            //stake
            lockId = IFraxFarmERC20(stakingAddress).manageStake(_liquidity, _secs, _useTargetStakeIndex, targetIndex);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //create a new locked state of _secs timelength with a Convex deposit token
    function stakeLockedConvexToken(uint256 _liquidity, uint256 _secs, bool _useTargetStakeIndex, uint256 targetIndex) external onlyOwner nonReentrant returns (uint256 lockId){
        if(_liquidity > 0){
            //pull tokens from user
            IERC20(convexDepositToken).safeTransferFrom(msg.sender, address(this), _liquidity);

            //stake into wrapper
            IConvexWrapperV2(stakingToken).stake(_liquidity, address(this));

            //stake into frax
            lockId = IFraxFarmERC20(stakingAddress).manageStake(_liquidity, _secs, _useTargetStakeIndex, targetIndex);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //create a new locked state of _secs timelength
    function stakeLocked(uint256 _liquidity, uint256 _secs, bool _useTargetStakeIndex, uint256 targetIndex) external onlyOwner nonReentrant returns (uint256 lockId){
        if(_liquidity > 0){
            //pull tokens from user
            IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _liquidity);

            //stake
            lockId = IFraxFarmERC20(stakingAddress).manageStake(IERC20(stakingToken).balanceOf(address(this)), _secs, _useTargetStakeIndex, targetIndex);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditional(uint256 _lockId, uint256 _addl_liq) external onlyOwner nonReentrant{
        if(_addl_liq > 0){
            //pull tokens from user
            IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _addl_liq);

            //add stake
            IFraxFarmERC20(stakingAddress).manageStake(IERC20(stakingToken).balanceOf(address(this)), 0, true, _lockId);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditionalCurveLp(uint256 _lockId, uint256 _addl_liq) external onlyOwner nonReentrant{
        if(_addl_liq > 0){
            //pull tokens from user
            IERC20(curveLpToken).safeTransferFrom(msg.sender, address(this), _addl_liq);

            //deposit into wrapper
            IConvexWrapperV2(stakingToken).deposit(_addl_liq, address(this));

            //add stake
            IFraxFarmERC20(stakingAddress).manageStake(_addl_liq, 0, true, _lockId);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    //add to a current lock
    function lockAdditionalConvexToken(uint256 _lockId, uint256 _addl_liq) external onlyOwner nonReentrant{
        if(_addl_liq > 0){
            //pull tokens from user
            IERC20(convexDepositToken).safeTransferFrom(msg.sender, address(this), _addl_liq);

            //stake into wrapper
            IConvexWrapperV2(stakingToken).stake(_addl_liq, address(this));

            //add stake
            IFraxFarmERC20(stakingAddress).manageStake(_addl_liq, 0, true, _lockId);
        }
        
        //checkpoint rewards
        _checkpointRewards();
    }

    // Extends the lock of an existing stake
    function lockLonger(uint256 additional_secs, uint256 _targetStakeIndex) external onlyOwner nonReentrant{
        //update time
        IFraxFarmERC20(stakingAddress).manageStake(0, additional_secs, true, _targetStakeIndex);

        //checkpoint rewards
        _checkpointRewards();
    }

    //withdraw a staked position
    function withdrawLocked(uint256 _lockId) external onlyOwner nonReentrant returns (uint256 _liquidity){        
        //withdraw directly to owner(msg.sender)
        _liquidity = IFraxFarmERC20(stakingAddress).withdrawLocked(_lockId, msg.sender);

        //checkpoint rewards
        _checkpointRewards();
    }

    //withdraw a staked position
    //frax farm transfers first before updating farm state so will checkpoint during transfer
    function withdrawLockedAndUnwrap(uint256 _lockId) external onlyOwner nonReentrant{
        //withdraw
        IFraxFarmERC20(stakingAddress).withdrawLocked(_lockId, address(this));

        //unwrap
        IConvexWrapperV2(stakingToken).withdrawAndUnwrap(IERC20(stakingToken).balanceOf(address(this)));
        IERC20(curveLpToken).transfer(owner,IERC20(curveLpToken).balanceOf(address(this)));

        //checkpoint rewards
        _checkpointRewards();
    }

    ////////// Lock Allowance & TransferFrom Authorization //////////
    function setAllowance(address spender, uint256 _lockId, uint256 amount) external override onlyOwner{
        IFraxFarmERC20(stakingAddress).setAllowance(spender, _lockId, amount);
    }
    function increaseAllowance(address spender, uint256 _lockId, uint256 amount) external override onlyOwner{
        IFraxFarmERC20(stakingAddress).increaseAllowance(spender, _lockId, amount);
    }
    function removeAllowance(address spender, uint256 _lockId) external override onlyOwner {
        IFraxFarmERC20(stakingAddress).removeAllowance(spender, _lockId);
    }
    function setApprovalForAll(address spender, bool approved) external override onlyOwner {
        IFraxFarmERC20(stakingAddress).setApprovalForAll(spender, approved);
    }

    /// @notice Transfer a locked stake, or portion of a locked stake to reciever_address, which must also be a Convex Vault
    /// @param receiver_address The addresss receiving the locked stake
    /// @param sender_lock_index The index of this vault's locked stake to send some or all of
    /// @param transfer_amount The amount of the underlying locked asset to transfer to the receiver
    /// @param use_receiver_lock_index Whether to target a specific locked stake to transfer the liquidity to
    /// @dev Can only send to an index if that stake's ending_timestamp is >= the sent ending timestamp - otherwise creates new stake
    /// @dev To prevent dust attacks, there is a max_locked_stakes limit set on the farm, which if hit, new stakes cannot be created (but if previously used, they can be reused)
    /// @param receiver_lock_index The target destination locked stake index to send liquidity to (ignored if use_reciever_lock_index is false)
    /// @return uint256 The sender's locked stake index
    /// @return uint256 The receiver's locked stake index
    function transferLocked(address receiver_address, uint256 sender_lock_index, uint256 transfer_amount, bool use_receiver_lock_index, uint256 receiver_lock_index) external onlyOwner nonReentrant returns(uint256,uint256){
        return(IFraxFarmERC20(stakingAddress).transferLocked(receiver_address, sender_lock_index, transfer_amount, use_receiver_lock_index, receiver_lock_index));
    }

    //helper function to combine earned tokens on staking contract and any tokens that are on this vault
    function earned() external view override returns (address[] memory token_addresses, uint256[] memory total_earned) {
        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(stakingAddress).getAllRewardTokens();
        uint256[] memory stakedearned = IFraxFarmERC20(stakingAddress).earned(address(this));
        IConvexWrapperV2.EarnedData[] memory convexrewards = IConvexWrapperV2(stakingToken).earnedView(address(this));

        uint256 extraRewardsLength = IRewards(rewards).rewardTokenLength();
        token_addresses = new address[](rewardTokens.length + extraRewardsLength + convexrewards.length);
        total_earned = new uint256[](rewardTokens.length + extraRewardsLength + convexrewards.length);

        //add any tokens that happen to be already claimed but sitting on the vault
        //(ex. withdraw claiming rewards)
        for(uint256 i; i < rewardTokens.length; i++){
            token_addresses[i] = rewardTokens[i];
            total_earned[i] = stakedearned[i] + IERC20(rewardTokens[i]).balanceOf(address(this));
        }

        IRewards.EarnedData[] memory extraRewards = IRewards(rewards).claimableRewards(address(this));
        for(uint256 i; i < extraRewards.length; i++){
            token_addresses[i+rewardTokens.length] = extraRewards[i].token;
            total_earned[i+rewardTokens.length] = extraRewards[i].amount;
        }

        //add convex farm earned tokens
        for(uint256 i; i < convexrewards.length; i++){
            token_addresses[i+rewardTokens.length+extraRewardsLength] = convexrewards[i].token;
            total_earned[i+rewardTokens.length+extraRewardsLength] = convexrewards[i].amount;
        }
    }

    /*
    claim flow:
        claim rewards directly to the vault
        calculate fees to send to fee deposit
        send fxs to a holder contract for fees
        get reward list of tokens that were received
        send all remaining tokens to owner
    A slightly less gas intensive approach could be to send rewards directly to a holder contract and have it sort everything out.
    However that makes the logic a bit more complex as well as runs a few future proofing risks
    */
    function getReward() external override{
        getReward(true);
    }

    //get reward with claim option.
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim) public override{

        //claim
        if(_claim){
            //claim frax farm
            IFraxFarmERC20(stakingAddress).getReward(address(this));
            //claim convex farm and forward to owner
            IConvexWrapperV2(stakingToken).getReward(address(this),owner);

            //double check there have been no crv/cvx claims directly to this address
            uint256 b = IERC20(crv).balanceOf(address(this));
            if(b > 0){
                IERC20(crv).safeTransfer(owner, b);
            }
            b = IERC20(cvx).balanceOf(address(this));
            if(b > 0){
                IERC20(cvx).safeTransfer(owner, b);
            }
        }

        //process fxs fees
        _processFxs();

        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(stakingAddress).getAllRewardTokens();

        //transfer
        _transferTokens(rewardTokens);

        //extra rewards
        _processExtraRewards();
    }

    //auxiliary function to supply token list(save a bit of gas + dont have to claim everything)
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim, address[] calldata _rewardTokenList)  external override{
        //claim
        if(_claim){
            //claim frax farm
            IFraxFarmERC20(stakingAddress).getReward(address(this));
            //claim convex farm and forward to owner
            IConvexWrapperV2(stakingToken).getReward(address(this),owner);
        }

        //process fxs fees
        _processFxs();

        //transfer
        _transferTokens(_rewardTokenList);

        //extra rewards
        _processExtraRewards();
    }

}
