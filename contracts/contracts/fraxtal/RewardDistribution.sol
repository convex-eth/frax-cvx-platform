// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
/**
 *Submitted for verification at Etherscan.io on 2020-07-17
 */

/*
   ____            __   __        __   _
  / __/__ __ ___  / /_ / /  ___  / /_ (_)__ __
 _\ \ / // // _ \/ __// _ \/ -_)/ __// / \ \ /
/___/ \_, //_//_/\__//_//_/\__/ \__//_/ /_\_\
     /___/

* Synthetix: BaseRewardPool.sol
*
* Docs: https://docs.synthetix.io/
*
*
* MIT License
* ===========
*
* Copyright (c) 2020 Synthetix
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

import "../interfaces/MathUtil.sol";
import "../interfaces/IVoterProxy.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


/*
 a managed reward contract which can manually set weights for any account address
*/
contract RewardDistribution {
    using SafeERC20 for IERC20;

    
    uint256 public constant duration = 7 days;

    IERC20 public immutable rewardToken;
    address public immutable owner;

    uint256 public pid;
    uint256 public periodFinish;
    uint256 public rewardRate;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards;
    uint256 public currentRewards;
    uint256 public historicalRewards;
    
    uint256 private _totalSupply;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;

    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);
    event RewardAdded(uint256 reward);
    event WeightSet(address indexed user, uint256 oldWeight, uint256 newWeight);
    event RewardPaid(address indexed user, uint256 reward);
    event AddDistributor(address indexed _distro, bool _valid);

    constructor(address _rewardToken, address _owner){
        rewardToken = IERC20(_rewardToken);
        owner = _owner;

        _setWeight(_owner, 1e18);
    }

    //total supply
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    //balance of an account
    function balanceOf(address _account) public view returns (uint256) {
        return _balances[_account];
    }

    //checkpoint earned rewards modifier
    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    //checkpoint a given user
    function user_checkpoint(address _account) public updateReward(_account){

    }

    //claim time to period finish
    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    //rewards per weight
    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / totalSupply());
    }

    //earned rewards for given account
    function earned(address _account) public view returns (uint256) {
        return rewards[_account] + (balanceOf(_account) * (rewardPerToken() - userRewardPerTokenPaid[_account]) / 1e18);
    }


    //increase reward weight for a given pool
    //used by reward manager
    function setWeight(address _account, uint256 _amount) external returns(bool){
        require(msg.sender == owner, "!authorized");
        return _setWeight(_account, _amount);
    }

    //increase reward weight for a list of pools
    //used by reward manager
    function setWeights(address[] calldata _account, uint256[] calldata _amount) external{
        require(msg.sender == owner, "!authorized");

        for(uint256 i = 0; i < _account.length; i++){
            _setWeight(_account[i], _amount[i]);
        }
    }

    //internal set weight
    function _setWeight(address _account, uint256 _amount)
        internal
        updateReward(_account)
        returns(bool)
    {
        emit WeightSet(_account, _balances[_account], _amount);

        uint256 tsupply = _totalSupply;
        tsupply -= _balances[_account]; //remove current from temp supply
        _balances[_account] = _amount; //set new account balance
        tsupply += _amount; //add new to temp supply
        _totalSupply = tsupply; //set supply

        return true;
    }

    //get reward
    function getReward(address _claimTo) public updateReward(msg.sender) returns(bool){
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(_claimTo, reward);
            emit RewardPaid(msg.sender, reward);
        }
        return true;
    }

    //outside address add to rewards
    function donate(uint256 _amount) external returns(bool){
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), _amount);
        queuedRewards += _amount;
        return true;
    }

    //distributor can add more rewards and start new reward cycle
    function queueNewRewards(uint256 _rewards) external returns(bool){
        require(msg.sender == IVoterProxy(owner).operator(), "!distro");

        //pull
        if(_rewards > 0){
            IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), _rewards);
        }

        //notify pulled + queued
        notifyRewardAmount(_rewards + queuedRewards);
        //reset queued
        queuedRewards = 0;
        return true;
    }


    //internal: start new reward cycle
    function notifyRewardAmount(uint256 reward)
        internal
        updateReward(address(0))
    {
        historicalRewards += reward;
        if (block.timestamp >= periodFinish) {
            rewardRate = reward / duration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            reward += leftover;
            rewardRate = reward / duration;
        }
        currentRewards = reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + duration;
        emit RewardAdded(reward);
    }
}