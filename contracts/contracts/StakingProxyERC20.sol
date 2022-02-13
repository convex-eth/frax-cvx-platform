// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IFeeRegistry.sol";
import "./interfaces/IFraxFarmERC20.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract StakingProxyERC20 {
    using SafeERC20 for IERC20;

    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    address public owner;
    address public feeRegistry; //todo: can convert to const
    address public stakingAddress;
    address public stakingToken;

    uint256 public constant FEE_DENOMINATOR = 10000;


    //initialize vault
    function initialize(address _owner, address _feeRegistry, address _stakingAddress, address _stakingToken) external{
        require(owner == address(0),"already init");

        //set variables
        owner = _owner;
        feeRegistry = _feeRegistry;
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

    /*
    claim flow:
        claim rewards directly to the vault
        calculate fees to send to fee deposit
        send fxs to booster for fees
        get reward list of tokens that were received
        send all remaining tokens to owner

    A slightly less gas intensive approach could be to send rewards directly to booster and have it sort everything out.
    However that makes the logic a bit more complex as well as runs a few future proofing risks
    */
    function getReward() external onlyOwner{

        //claim
        IFraxFarmERC20(stakingAddress).getReward(address(this));

        //process fxs fees
        _processFxs();

        //get list of reward tokens
        address[] memory rewardTokens = IFraxFarmERC20(stakingAddress).getAllRewardTokens();

        //transfer
        _transferTokens(rewardTokens);
    }

    //auxiliary function to supply token list(same a bit of gas + dont have to claim everything)
    //_claim bool is for the off chance that rewardCollectionPause is true so getReward() fails but
    //there are tokens on this vault for cases such as withdraw() also calling claim.
    //can also be used to rescue tokens on the vault
    function getReward(bool _claim, address[] calldata _rewardTokenList) external onlyOwner{

        //claim
        if(_claim){
            IFraxFarmERC20(stakingAddress).getReward(address(this));
        }

        //process fxs fees
        _processFxs();

        //transfer
        _transferTokens(_rewardTokenList);
    }

    //apply fees to fxs and send remaining to owner
    function _processFxs() internal{

        //get fee rate from booster
        uint256 totalFees = IFeeRegistry(feeRegistry).totalFees();

        //send fxs fees to fee deposit
        uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));
        uint256 feesToSend = fxsBalance * totalFees / FEE_DENOMINATOR;
        IERC20(fxs).transfer(IFeeRegistry(feeRegistry).feeDeposit(), feesToSend);

        //transfer remaining fxs to owner
        IERC20(fxs).transfer(msg.sender, IERC20(fxs).balanceOf(address(this)));
    }

    //transfer other reward tokens besides fxs(which needs to have fees applied)
    function _transferTokens(address[] memory _tokens) internal{
        //transfer all tokens
        for(uint256 i = 0; i < _tokens.length; i++){
            if(_tokens[i] != fxs){
                IERC20(_tokens[i]).transfer(msg.sender, IERC20(_tokens[i]).balanceOf(address(this)));
            }
        }
    }
}
