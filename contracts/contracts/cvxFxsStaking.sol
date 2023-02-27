// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/MathUtil.sol";
import "./interfaces/IBooster.sol";
import "./interfaces/IVoterProxy.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract cvxFxsStaking is ReentrancyGuard{
    using SafeERC20 for IERC20;


    /* ========== STATE VARIABLES ========== */

    struct Reward {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    struct EarnedData {
        address token;
        uint256 amount;
    }

    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant cvxfxs = address(0xFEEf77d3f69374f66429C91d732A244f074bdf74);

    //rewards
    address[] public rewardTokens;
    mapping(address => Reward) public rewardData;

    // Duration that rewards are streamed over
    uint256 public constant rewardsDuration = 86400 * 7;

    // reward token -> distributor -> is approved to add rewards
    mapping(address => mapping(address => bool)) public rewardDistributors;

    // user -> reward token -> amount
    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    mapping(address => mapping(address => uint256)) public rewards;

  
    //mappings for balance data
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
 

    /* ========== CONSTRUCTOR ========== */

    constructor() {
    }

    /* ========== ADMIN CONFIGURATION ========== */

    // Add a new reward token to be distributed to stakers
    function addReward(
        address _rewardsToken,
        address _distributor
    ) public onlyOwner {
        require(rewardData[_rewardsToken].lastUpdateTime == 0);

        rewardTokens.push(_rewardsToken);
        rewardData[_rewardsToken].lastUpdateTime = block.timestamp;
        rewardData[_rewardsToken].periodFinish = block.timestamp;
        rewardDistributors[_rewardsToken][_distributor] = true;
        emit RewardAdded(_rewardsToken, _distributor);
    }

    // Modify approval for an address to call notifyRewardAmount
    function approveRewardDistributor(
        address _rewardsToken,
        address _distributor,
        bool _approved
    ) external onlyOwner {
        require(rewardData[_rewardsToken].lastUpdateTime > 0);
        rewardDistributors[_rewardsToken][_distributor] = _approved;
        emit RewardDistributorApproved(_rewardsToken, _distributor);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint256 _amount) public nonReentrant updateReward(msg.sender){
        require(_amount > 0, 'RewardPool : Cannot stake 0');

        balances[msg.sender] += _amount;
        totalSupply += _amount;

        IERC20(cvxfxs).safeTransferFrom(msg.sender, address(this), _amount);
        
        emit Staked(msg.sender, _amount);
    }

    function stakeAll() external returns(bool){
        uint256 balance = IERC20(cvxfxs).balanceOf(msg.sender);
        stake(balance);
        return true;
    }

    function stakeFor(address _for, uint256 _amount)
        external
        nonReentrant
        updateReward(_for)
        returns(bool)
    {
        require(_amount > 0, 'RewardPool : Cannot stake 0');
        
        //give to _for
        balances[_for] += _amount;
        totalSupply += _amount;

        //take away from sender
        IERC20(cvxfxs).safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(_for, _amount);
        
        return true;
    }

    function withdraw(uint256 _amount) external nonReentrant updateReward(msg.sender){
        require(_amount > 0, 'RewardPool : Cannot withdraw 0');

        balances[msg.sender] -= _amount;
        totalSupply -= _amount;

        IERC20(cvxfxs).safeTransfer(msg.sender, _amount);

        emit Withdrawn(msg.sender, _amount);
    }


    /* ========== VIEWS ========== */

    function _rewardPerToken(address _rewardsToken) internal view returns(uint256) {
        if (totalSupply == 0) {
            return rewardData[_rewardsToken].rewardPerTokenStored;
        }
        return
        rewardData[_rewardsToken].rewardPerTokenStored 
        + (
            (_lastTimeRewardApplicable(rewardData[_rewardsToken].periodFinish) - rewardData[_rewardsToken].lastUpdateTime)     
            * rewardData[_rewardsToken].rewardRate
            * 1e18
            / totalSupply
        );
    }

    function _earned(
        address _user,
        address _rewardsToken,
        uint256 _balance
    ) internal view returns(uint256) {
        return (_balance * (_rewardPerToken(_rewardsToken) - userRewardPerTokenPaid[_user][_rewardsToken] ) / 1e18) + rewards[_user][_rewardsToken];
    }

    function _lastTimeRewardApplicable(uint256 _finishTime) internal view returns(uint256){
        return MathUtil.min(block.timestamp, _finishTime);
    }

    function lastTimeRewardApplicable(address _rewardsToken) public view returns(uint256) {
        return _lastTimeRewardApplicable(rewardData[_rewardsToken].periodFinish);
    }

    function rewardPerToken(address _rewardsToken) external view returns(uint256) {
        return _rewardPerToken(_rewardsToken);
    }

    function getRewardForDuration(address _rewardsToken) external view returns(uint256) {
        return rewardData[_rewardsToken].rewardRate * rewardsDuration;
    }

    // Address and claimable amount of all reward tokens for the given account
    function claimableRewards(address _account) external view returns(EarnedData[] memory userRewards) {
        userRewards = new EarnedData[](rewardTokens.length);
        for (uint256 i = 0; i < userRewards.length; i++) {
            address token = rewardTokens[i];
            userRewards[i].token = token;
            userRewards[i].amount = _earned(_account, token,  balances[_account]);
        }
        return userRewards;
    }

    function balanceOf(address _user) view external returns(uint256 amount) {
        return balances[_user];
    }

    // Claim all pending rewards
    function getReward(address _forward) public nonReentrant updateReward(msg.sender) {
        for (uint i; i < rewardTokens.length; i++) {
            address _rewardsToken = rewardTokens[i];
            uint256 reward = rewards[msg.sender][_rewardsToken];
            if (reward > 0) {
                rewards[msg.sender][_rewardsToken] = 0;
                IERC20(_rewardsToken).safeTransfer(_forward, reward);
                emit RewardPaid(msg.sender, _rewardsToken, reward);
            }
        }
    }


    /* ========== RESTRICTED FUNCTIONS ========== */

    function rewardTokenLength() external view returns(uint256){
        return rewardTokens.length;
    }

    function _notifyReward(address _rewardsToken, uint256 _reward) internal {
        Reward storage rdata = rewardData[_rewardsToken];

        if (block.timestamp >= rdata.periodFinish) {
            rdata.rewardRate = _reward / rewardsDuration;
        } else {
            uint256 remaining = rdata.periodFinish - block.timestamp;
            uint256 leftover = remaining * rdata.rewardRate;
            rdata.rewardRate = (_reward + leftover) / rewardsDuration;
        }

        rdata.lastUpdateTime = block.timestamp;
        rdata.periodFinish = block.timestamp + rewardsDuration;
    }

    function notifyRewardAmount(address _rewardsToken, uint256 _reward) external nonReentrant updateReward(address(0)) {
        require(rewardDistributors[_rewardsToken][msg.sender]);
        require(_reward > 0 && _reward < 1e30, "bad reward value");

        _notifyReward(_rewardsToken, _reward);

        // handle the transfer of reward tokens via `transferFrom` to reduce the number
        // of transactions required and ensure correctness of the _reward amount
        IERC20(_rewardsToken).safeTransferFrom(msg.sender, address(this), _reward);
        
        emit RewardAdded(_rewardsToken, _reward);
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external nonReentrant onlyOwner {
        require(rewardData[_tokenAddress].lastUpdateTime == 0, "Cannot withdraw reward token");
        IERC20(_tokenAddress).safeTransfer(IBooster(IVoterProxy(vefxsProxy).operator()).rewardManager(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        require(IBooster(IVoterProxy(vefxsProxy).operator()).rewardManager() == msg.sender, "!owner");
        _;
    }

    modifier updateReward(address _account) {
        uint256 userBal = balances[_account];
        for (uint i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            rewardData[token].rewardPerTokenStored = _rewardPerToken(token);
            rewardData[token].lastUpdateTime = _lastTimeRewardApplicable(rewardData[token].periodFinish);
            if (_account != address(0)) {
                rewards[_account][token] = _earned(_account, token, userBal );
                userRewardPerTokenPaid[_account][token] = rewardData[token].rewardPerTokenStored;
            }
        }
        _;
    }

    /* ========== EVENTS ========== */
    event RewardAdded(address indexed _token, uint256 _reward);
    event Staked(address indexed _user, uint256 _amount);
    event Withdrawn(address indexed _user, uint256 _amount);
    event RewardPaid(address indexed _user, address indexed _rewardsToken, uint256 _reward);
    event Recovered(address _token, uint256 _amount);
    event RewardAdded(address indexed _reward, address indexed _distributor);
    event RewardDistributorApproved(address indexed _reward, address indexed _distributor);
}