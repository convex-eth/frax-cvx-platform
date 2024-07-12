// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IBooster.sol";
import "../interfaces/IVoterProxy.sol";
import "../interfaces/IFraxtalVoteEscrow.sol";
import "../interfaces/IFpisMigrate.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/*
Fpis locker - pull fpis from migration contract and lock
*/
contract FraxtalFpisLocker{
    using SafeERC20 for IERC20;

    uint256 private constant MAXTIME = 4 * 365 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    address public immutable staker;
    address public immutable migrator;
    address public immutable fpis;
    uint256 public unlockTime;

    event Deposited(address indexed _address, uint256 _amount);
    event TimeIncreased(uint256 _end);

    constructor(address _staker, address _migrator, address _fpis){
        staker = _staker;
        migrator = _migrator;
        fpis = _fpis;
        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;
        unlockTime = unlockInWeeks;
    }

    modifier onlyOwner() {
        require(IBooster(_currentBooster()).owner() == msg.sender, "!owner");
        _;
    }

    function revertOwnership() external onlyOwner{
        IFpisMigrate(migrator).setPendingOwner( IBooster(_currentBooster()).owner() );
    }

    function acceptOwnership() external{
        IFpisMigrate(migrator).acceptPendingOwner();
    }

    function _currentBooster() internal view returns(address){
        return IVoterProxy(staker).operator();
    }

    //lock
    function _lock() internal {
        uint256 balance = IERC20(fpis).balanceOf(address(this));
        if(balance > 0){
            IERC20(fpis).safeTransfer(staker, balance);
        }
        
        //increase ammount
        uint256 balanceStaker = IERC20(fpis).balanceOf(staker);
        if(balanceStaker > 0){
            //increase amount
            IBooster(_currentBooster()).increaseFpisAmount(balanceStaker,0);
        }
        
        //increase time
        increaseLockTime();
    }

    function nextUnlock() external view returns(uint256){
        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;
        return unlockInWeeks;
    }

    function increaseLockTime() public{
        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt/WEEK)*WEEK;

        //increase time if needed
        if( unlockInWeeks > unlockTime){
            IBooster(_currentBooster()).increaseFpisUnlockTime(uint128(unlockAt),0);
            unlockTime = unlockInWeeks;
            emit TimeIncreased(unlockAt);
        }
    }

    function lock() external {
        IFpisMigrate(migrator).withdrawTo(fpis,IERC20(fpis).balanceOf(migrator),staker);
        _lock();
    }
}