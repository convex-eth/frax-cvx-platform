// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IBooster.sol";
import "./interfaces/IVoterProxy.sol";
import "./interfaces/IFeeReceiver.sol";
import "./interfaces/IRewards.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';



contract FeeReceiverVeFxs is IFeeReceiver {
    using SafeERC20 for IERC20;

    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant cvxDistro = address(0x449f2fd99174e1785CF2A1c79E665Fec3dD1DdC6);
    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    uint256 public constant denominator = 10000;
    address public immutable forwardAddress;

    address public platformReceiver;
    uint256 public platformFees;

    event RewardsDistributed(address indexed token, uint256 amount);
    event SetPlatformFees(address _account, uint256 _fees);
    event WithdrawTo(address indexed _address, uint256 _amount);
    event ReceivePlatformFees(address indexed _address, uint256 _amount);
    event ForwardFees(address indexed _address, uint256 _amount);

    constructor(address _forwardAddress, address _platformReceiver, uint256 _platformFees) {
        forwardAddress = _forwardAddress;
        platformReceiver = _platformReceiver;
        platformFees = _platformFees;
    }

    modifier onlyOwner() {
        require(IBooster(IVoterProxy(vefxsProxy).operator()).owner() == msg.sender, "!owner");
        _;
    }

    function setPlatformFees(address _receiver, uint256 _fees) external onlyOwner{
        require(_fees < 2000,"too high");
        platformFees = _fees;
        platformReceiver = _receiver;
        emit SetPlatformFees(_receiver, _fees);
    }

    function withdrawTo(address _asset, uint256 _amount, address _to) external onlyOwner{
        require(_asset != fxs, "invalid asset");

        IERC20(_asset).safeTransfer(_to, _amount);
        emit WithdrawTo(_to, _amount);
    }

    function processFees() external {
        uint256 tokenbalance = IERC20(fxs).balanceOf(address(this));
       
        //take platform fees if set
        if(platformReceiver != address(0)){
            uint256 platformRewards = tokenbalance * platformFees / denominator;
            IERC20(fxs).transfer(platformReceiver,platformRewards);
            emit ReceivePlatformFees(platformReceiver, platformRewards);
            tokenbalance -= platformRewards;
        }

        //process fxs
        if(tokenbalance > 0){
            //send to rewards
            IERC20(fxs).transfer(forwardAddress,tokenbalance);
            emit ForwardFees(forwardAddress, tokenbalance);
        }
    }

}