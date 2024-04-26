// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ITokenMinter.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract FpisMigrate is ReentrancyGuard{
    using SafeERC20 for IERC20;

    address public owner;
    address public pendingOwner;

    address public immutable fpis;
    address public immutable cvxfpis;
    address public immutable cvxfxs;
    uint256 public immutable rate;
    
    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);
    event WithdrawTo(address indexed _address, uint256 _amount);
    event Migrated(address indexed _address, uint256 _fpis, uint256 _cvxfpis, uint256 _cvxfxs);

    constructor(address _fpis, address _cvxfpis, address _cvxfxs, uint256 _rate){
        owner = msg.sender;
        fpis = _fpis;
        cvxfpis = _cvxfpis;
        cvxfxs = _cvxfxs;
        rate = _rate;
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

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == owner,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external {
        require(msg.sender == owner, "!auth");

        _asset.safeTransfer(_to, _amount);
        emit WithdrawTo(_to, _amount);
    }

    function migrate(uint256 _fpisAmount, uint256 _cvxfpisAmount) external nonReentrant{
        //pull fpis
        if(_fpisAmount > 0){
            IERC20(fpis).safeTransferFrom(msg.sender, address(this), _fpisAmount);
        }

        //pull cvxfpis
        if(_cvxfpisAmount > 0){
            IERC20(cvxfpis).safeTransferFrom(msg.sender, address(this), _cvxfpisAmount);
        }

        //combine
        uint256 mintAmount = _fpisAmount + _cvxfpisAmount;
        //apply rate
        mintAmount = mintAmount / rate;
        require(mintAmount > 0,"!minimal amount");

        //mint back cvxfxs
        ITokenMinter(cvxfxs).mint(msg.sender, mintAmount);
        emit Migrated(msg.sender, _fpisAmount, _cvxfpisAmount, mintAmount);
    }
}