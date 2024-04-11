// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IStaker.sol";
import "../interfaces/ITokenMinter.sol";
import "../interfaces/IVoterProxy.sol";
import "../interfaces/IFraxtalVoteEscrow.sol";
import "../interfaces/IERC4626.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/*
FxsDepositor for Fraxtal
Deposit Fxs, lock as veFxs, and mint cvxFxs
*/

contract FraxtalFxsDepositor{
    using SafeERC20 for IERC20;

    uint256 private constant MAXTIME = 4 * 365 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    address public immutable staker;
    address public immutable minter;
    address public immutable fxs;
    uint256 public unlockTime;

    event Deposited(address indexed _address, uint256 _amount);
    event TimeIncreased(uint256 _end);

    constructor(address _staker, address _minter, address _fxs){
        staker = _staker;
        minter = _minter;
        fxs = _fxs;
    }

    function _currentBooster() internal view returns(address){
        return IVoterProxy(staker).operator();
    }

    //lock
    function _lockFxs() internal {
        uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));
        if(fxsBalance > 0){
            IERC20(fxs).safeTransfer(staker, fxsBalance);
        }
        
        //increase ammount
        uint256 fxsBalanceStaker = IERC20(fxs).balanceOf(staker);
        if(fxsBalanceStaker == 0){
            return;
        }
        
        //increase amount
        IFraxtalVoteEscrow(_currentBooster()).increaseAmount(fxsBalanceStaker,0);
        
        //increase time
        increaseLockTime();
    }

    function increaseLockTime() public{
        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;

        //increase time too if over 1 week buffer
        if( unlockInWeeks - unlockTime >= 1){
            IFraxtalVoteEscrow(_currentBooster()).increaseUnlockTime(uint128(unlockAt),0);
            unlockTime = unlockInWeeks;
            emit TimeIncreased(unlockAt);
        }
    }

    function lockFxs() external {
        _lockFxs();
    }

    //deposit fxs for cvxFxs
    function deposit(uint256 _amount, address _stakeAddress) public {
        require(_amount > 0,"!>0");
        
        //transfer and lock
        IERC20(fxs).safeTransferFrom(msg.sender, staker, _amount);
        _lockFxs();

        if(_stakeAddress == address(0)){
            //mint for msg.sender
            ITokenMinter(minter).mint(msg.sender,_amount);
        }else{
            //mint here and stake
            ITokenMinter(minter).mint(address(this),_amount);
            IERC20(minter).safeApprove(_stakeAddress, _amount);
            IERC4626(_stakeAddress).deposit(_amount, msg.sender);
        }
        emit Deposited(msg.sender, _amount);
    }

    function depositAll(address _stakeAddress) external{
        uint256 fxsBal = IERC20(fxs).balanceOf(msg.sender);
        deposit(fxsBal,_stakeAddress);
    }
}