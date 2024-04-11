// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IBooster.sol";
import "../interfaces/IVoterProxy.sol";
import "../interfaces/IFxsDepositor.sol";
import "../interfaces/IFraxtalVoteEscrow.sol";
import "../interfaces/IERC4626.sol";

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


//distribute rewards without trailing periods
//
//Reward distro based on Curve.fi's gauge wrapper implementations at https://github.com/curvefi/curve-dao-contracts/tree/master/contracts/gauges/wrappers
contract StakedCvxFxs is ERC20, ReentrancyGuard, IERC4626{
    using SafeERC20 for IERC20;

    struct EarnedData {
        address token;
        uint256 amount;
    }

    struct RewardType {
        address reward_token;
        uint256 reward_integral;
        uint256 reward_remaining;
    }

    //pool and system info
    address public immutable voteproxy;
    address public immutable stakingToken; //cvxfxs
    address public immutable fxs;


    //rewards
    RewardType[] public rewards;
    mapping(address => mapping(address => uint256)) public reward_integral_for;// token -> account -> integral
    mapping(address => mapping(address => uint256)) public claimable_reward;//token -> account -> claimable
    mapping(address => uint256) public rewardMap;
    mapping(address => address) public rewardRedirect;
    uint256 public constant maxRewards = 12;
    bool private isEWithdraw;

    //events
    event Staked(address indexed _user, uint256 _amount);
    event Withdrawn(address indexed _user, uint256 _amount);
    event EmergencyWithdrawn(address indexed _user, uint256 _amount);
    event RewardPaid(address indexed _user, address indexed _rewardToken, address indexed _receiver, uint256 _rewardAmount);
    event RewardAdded(address indexed _rewardToken);
    event RewardInvalidated(address _rewardToken);
    event RewardRedirected(address indexed _account, address _forward);

    constructor(address _stakingToken, address _fxs, address _voteproxy) ERC20(
            "Staked cvxFxs",
            "stkcvxFxs"
        ){
        stakingToken = _stakingToken;
        fxs = _fxs;
        voteproxy = _voteproxy;

        _insertRewardToken(_fxs);
    }

    function _currentBooster() internal view returns(address){
        return IVoterProxy(voteproxy).operator();
    }

    //register an extra reward token to be handled
    function addExtraReward(address _token) external nonReentrant{
        //reward manager can set extra rewards
        require( IBooster(_currentBooster()).rewardManager() == msg.sender, "!owner");
        
        //add to reward list
        _insertRewardToken(_token);
    }

    //insert a new reward, ignore if already registered or invalid
    function _insertRewardToken(address _token) internal{
        if(_token == address(this) || _token == address(0)){
            //dont allow reward tracking of the staking token or invalid address
            return;
        }

        //add to reward list if new
        if(rewardMap[_token] == 0){
            //check reward count for new additions
            require(rewards.length < maxRewards, "max rewards");

            //set token
            RewardType storage r = rewards.push();
            r.reward_token = _token;
            
            //set map index after push (mapped value is +1 of real index)
            rewardMap[_token] = rewards.length;

            //workaround: transfer 0 to self so that earned() reports correctly
            //with new tokens
            try IERC20(_token).transfer(address(this), 0){}catch{}

            emit RewardAdded(_token);
        }else{
            //get previous used index of given token
            //this ensures that reviving can only be done on the previous used slot
            uint256 index = rewardMap[_token];
            //index is rewardMap minus one
            RewardType storage reward = rewards[index-1];
            //check if it was invalidated
            if(reward.reward_token == address(0)){
                //revive
                reward.reward_token = _token;
            }
        }
    }

    //allow invalidating a reward if the token causes trouble in calcRewardIntegral
    function invalidateReward(address _token) public nonReentrant{
        require(IBooster(_currentBooster()).rewardManager() == msg.sender, "!owner");

        uint256 index = rewardMap[_token];
        if(index > 0){
            //index is registered rewards minus one
            RewardType storage reward = rewards[index-1];
            require(reward.reward_token == _token, "!mismatch");
            //set reward token address to 0, integral calc will now skip
            reward.reward_token = address(0);
            emit RewardInvalidated(_token);
        }
    }

    //claim rewards
    function _claimRewards() internal{
        //claim all rewards from booster
        try IBooster(_currentBooster()).claimFees(){}catch{}
    }

    //get reward count
    function rewardLength() external view returns(uint256) {
        return rewards.length;
    }

    //calculate and record an account's earnings of the given reward.  if _claimTo is given it will also claim.
    function _calcRewardIntegral(uint256 _index, address _account, address _claimTo) internal{
        RewardType storage reward = rewards[_index];
        //skip invalidated rewards
         //if a reward token starts throwing an error, calcRewardIntegral needs a way to exit
         if(reward.reward_token == address(0)){
            return;
         }

        //get difference in balance and remaining rewards
        //getReward is unguarded so we use reward_remaining to keep track of how much was actually claimed since last checkpoint
        uint256 bal = IERC20(reward.reward_token).balanceOf(address(this));

        //update the global integral
        if (totalSupply() > 0 && bal > reward.reward_remaining) {
            reward.reward_integral = reward.reward_integral + ((bal - reward.reward_remaining) * 1e20 / totalSupply());
        }

        //update user integrals
        uint userI = reward_integral_for[reward.reward_token][_account];
        if(_claimTo != address(0) || userI < reward.reward_integral){
            //_claimTo address non-zero means its a claim 
            if(_claimTo != address(0)){
                uint256 receiveable = claimable_reward[reward.reward_token][_account] + (balanceOf(_account) * (reward.reward_integral - userI) / 1e20);
                if(receiveable > 0){
                    claimable_reward[reward.reward_token][_account] = 0;
                    IERC20(reward.reward_token).safeTransfer(_claimTo, receiveable);
                    emit RewardPaid(_account, reward.reward_token, _claimTo, receiveable);
                    //remove what was claimed from balance
                    bal -= receiveable;
                }
            }else{
                claimable_reward[reward.reward_token][_account] = claimable_reward[reward.reward_token][_account] + ( balanceOf(_account) * (reward.reward_integral - userI) / 1e20);
            }
            reward_integral_for[reward.reward_token][_account] = reward.reward_integral;
        }


        //update remaining reward so that next claim can properly calculate the balance change
        if(bal != reward.reward_remaining){
            reward.reward_remaining = bal;
        }
    }

    //checkpoint without claiming
    function _checkpoint(address _account) internal {
        //checkpoint without claiming by passing address(0)
        _checkpoint(_account, address(0));
    }

    //checkpoint with claim
    function _checkpoint(address _account, address _claimTo) internal nonReentrant{
        //claim all rewards
        _claimRewards();

        //calc reward integrals
        uint256 rewardCount = rewards.length;
        for(uint256 i = 0; i < rewardCount; i++){
           _calcRewardIntegral(i,_account,_claimTo);
        }
    }

    //manually checkpoint a user account
    function user_checkpoint(address _account) external returns(bool) {
        _checkpoint(_account);
        return true;
    }

    //get earned token info
    //change ABI to view to use this off chain
    function earned(address _account) external returns(EarnedData[] memory claimable) {
        
        //because this is a state mutative function
        //we can simplify the earned() logic of all rewards (internal and external)
        //and allow this contract to be agnostic to outside reward contract design
        //by just claiming everything and updating state via _checkpoint()
        _checkpoint(_account);
        uint256 rewardCount = rewards.length;
        claimable = new EarnedData[](rewardCount);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardType storage reward = rewards[i];

            //skip invalidated rewards
            if(reward.reward_token == address(0)){
                continue;
            }
    
            claimable[i].amount = claimable_reward[reward.reward_token][_account];
            claimable[i].token = reward.reward_token;
        }
        return claimable;
    }

    //set any claimed rewards to automatically go to a different address
    //set address to zero to disable
    function setRewardRedirect(address _to) external nonReentrant{
        rewardRedirect[msg.sender] = _to;
        emit RewardRedirected(msg.sender, _to);
    }

    //claim reward for given account (unguarded)
    function getReward(address _account) external {
        //check if there is a redirect address
        if(rewardRedirect[_account] != address(0)){
            _checkpoint(_account, rewardRedirect[_account]);
        }else{
            //claim directly in checkpoint logic to save a bit of gas
            _checkpoint(_account, _account);
        }
    }

    //claim reward for given account and forward (guarded)
    function getReward(address _account, address _forwardTo) external {
        //in order to forward, must be called by the account itself
        require(msg.sender == _account, "!self");
        //use _forwardTo address instead of _account
        _checkpoint(_account,_forwardTo);
    }

    //stake cvxfxs
    function stake(uint256 _amount, address _to) public {
        //dont need to call checkpoint since _mint() will

        if (_amount > 0) {
            //deposit
            _mint(_to, _amount);
            IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _amount);
        }

        emit Staked(_to, _amount);
    }

    //backwards compatibility for other systems (note: amount and address reversed)
    function stakeFor(address _to, uint256 _amount) external {
        stake(_amount, _to);
    }

    //withdraw balance and unwrap to the underlying lp token
    function withdraw(uint256 _amount, bool _claim) public returns(bool){

        //checkpoint first if claiming, or burn will call checkpoint anyway
        if(_claim){
            //checkpoint with claim flag
            _checkpoint(msg.sender, msg.sender);
        }

        //change state
        //burn will also call checkpoint
        _burn(msg.sender, _amount);

        //send to user
        IERC20(stakingToken).safeTransfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _amount);

        return true;
    }

    //withdraw balance and unwrap to the underlying lp token
    //but avoid checkpointing.  will lose non-checkpointed rewards but can withdraw
    function emergencyWithdraw(uint256 _amount) public nonReentrant returns(bool){

        //toggle flag to skip checkpoints
        isEWithdraw = true;

        //burn without calling checkpoint (skipped in _beforeTokenTransfer)
        _burn(msg.sender, _amount);

        //retoggle flag to use checkpoints
        isEWithdraw = false;

        //send to user
        IERC20(stakingToken).safeTransfer(msg.sender, _amount);

        emit EmergencyWithdrawn(msg.sender, _amount);
        return true;
    }

    //withdraw full balance
    function withdrawAll(bool claim) external{
        withdraw(balanceOf(msg.sender),claim);
    }

    function _beforeTokenTransfer(address _from, address _to, uint256) internal override {
        if(!isEWithdraw){
            if(_from != address(0)){
                _checkpoint(_from);
            }
            if(_to != address(0)){
                _checkpoint(_to);
            }
        }
    }


    //erc4626
    function asset() external view returns(address){
        return stakingToken;
    }

    function totalAssets() external view returns(uint256){
        return totalSupply();
    }

    function deposit(uint256 _amount, address _to) public returns(uint256){
        stake(_amount, _to);
        return _amount;
    }

    function convertToShares(uint256 assets) external pure returns (uint256 shares){
        return assets;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256 assets){
        return shares;
    }

    function maxDeposit(address receiver) external view returns (uint256){
        return IERC20(stakingToken).balanceOf(receiver);
    }

    function previewDeposit(uint256 assets) external pure returns (uint256){
        return assets;
    }

    function maxMint(address receiver) external view returns (uint256){
        return IERC20(stakingToken).balanceOf(receiver);
    }

    function previewMint(uint256 shares) external pure returns (uint256){
        return shares;
    }

    function mint(uint256 shares, address receiver) external returns (uint256 assets){
        return deposit(shares, receiver);
    }

    function maxWithdraw(address owner) external view returns (uint256){
        return balanceOf(owner);
    }

    function previewWithdraw(uint256 assets) external pure returns (uint256){
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares){
        require(msg.sender == owner && receiver == owner,"!receiver");
        withdraw(assets, true);
        return shares;
    }

    function maxRedeem(address owner) external view returns (uint256){
        return balanceOf(owner);
    }

    function previewRedeem(uint256 shares) external pure returns (uint256){
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets){
        require(msg.sender == owner && receiver == owner,"!receiver");
        withdraw(shares, true);
        return shares;
    }
}