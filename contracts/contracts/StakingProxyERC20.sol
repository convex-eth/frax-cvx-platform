// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

// import "./interfaces/IDeposit.sol";
// import "./interfaces/IProxyFactory.sol";
// import "./interfaces/IVirtualBalanceRewardPool.sol";
import "./interfaces/IFraxFarmERC20.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract StakingProxyERC20 {
    using SafeERC20 for IERC20;

    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    address public owner;
    address public booster; //could probably be const and redeploy pool implementation if booster updated
    address public stakingAddress;
    address public stakingToken;
    bool public isInit;


    function initialize(address _owner, address _booster, address _stakingAddress, address _stakingToken) external{
        require(!isInit,"already init");

        //set variables
        owner = _owner;
        booster = _booster;
        stakingAddress = _stakingAddress;
        stakingToken = _stakingToken;

        //set proxy address on staking contract
        IFraxFarmERC20(stakingAddress).stakerSetVeFXSProxy(vefxsProxy);

        //set infinite approval
        IERC20(stakingToken).approve(stakingAddress, type(uint256).max);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    //create a new locked state of _secs timelength
    function stakeLocked(uint256 _liquidity, uint256 _secs) external onlyOwner{
        //pull tokens from user
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _liquidity);

        //stake
        IFraxFarmERC20(stakingAddress).stakeLocked(_liquidity, _secs);
    }

    //add to a current lock
    function lockAdditional(bytes32 _kek_id, uint256 _addl_liq) external onlyOwner{
        //pull tokens from user
        IERC20(stakingToken).safeTransferFrom(msg.sender, address(this), _addl_liq);

        //add stake
        IFraxFarmERC20(stakingAddress).lockAdditional(_kek_id, _addl_liq);
    }

    function withdrawLocked(bytes32 _kek_id) external onlyOwner{
        //withdraw directly to owner(msg.sender)
        IFraxFarmERC20(stakingAddress).withdrawLocked(_kek_id, msg.sender);
    }

    function getReward() external onlyOwner{
        //getReward first goes to booster to extract fees
        //by going to booster first, we can reduce erc20 transfers from 3 to 2
        IFraxFarmERC20(stakingAddress).getReward(booster);

        //TODO: booster hold fees and forward rest to user
        //TODO: handle non-fxs rewards
    }
}
