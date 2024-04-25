// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IFraxtalBridge.sol";
import "./interfaces/IFeeReceiver.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract FeeBridge{
    using SafeERC20 for IERC20;

    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    address public owner;
    address public pendingOwner;

    address public immutable fraxtalbridge;
    address public immutable l2receiver;
    address public immutable l1token;
    address public immutable l2token;
    
    uint256 public bridgeShare;
    address public returnAddress;
    uint32 public minGasLimit;

    event Bridged(uint256 _amount);
    event Returned(uint256 _amount);
    event SetBridgeShare(uint256 _amount, address _returnAddress);
    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);

    constructor(address _bridge, address _l1token, address _l2token, address _l2receiver, uint256 _share, address _returnAddress){
        owner = msg.sender;
        l1token = _l1token;
        l2token = _l2token;
        fraxtalbridge = _bridge;
        l2receiver = _l2receiver;
        bridgeShare = _share;
        returnAddress = _returnAddress;
        minGasLimit = 200000;
        IERC20(l1token).approve(_bridge, type(uint256).max);
    }

    //set next owner
    function setPendingOwner(address _po) external {
        require(msg.sender == owner, "!auth");
        pendingOwner = _po;
        emit SetPendingOwner(_po);
    }

    //claim ownership
    function acceptPendingOwner() external {
        require(msg.sender == pendingOwner, "!p_owner");

        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnerChanged(owner);
    }

    function setBridgeShare(uint256 _share, address _returnAddress) external {
        require(msg.sender == owner, "!auth");

        bridgeShare = _share;
        returnAddress = _returnAddress;
        emit SetBridgeShare(_share, _returnAddress);
    }

    function setBridgeGasLimit(uint32 _limit) external {
        require(msg.sender == owner, "!auth");

        minGasLimit = _limit;
    }

    function processFees() external{
        uint256 balance = IERC20(l1token).balanceOf(address(this));
        if(balance > 0){
            balance = balance * bridgeShare / 10000;
            IFraxtalBridge(fraxtalbridge).depositERC20To(l1token, l2token, l2receiver, balance, minGasLimit, "");
            emit Bridged(balance);

            balance = IERC20(l1token).balanceOf(address(this));
            IERC20(l1token).safeTransfer(returnAddress, balance);
            emit Returned(balance);
            IFeeReceiver(returnAddress).processFees();
        }
    }
}