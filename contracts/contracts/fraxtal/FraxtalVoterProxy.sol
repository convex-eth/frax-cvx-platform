// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IDeposit.sol";

contract FraxtalVoterProxy {

    address public owner;
    address public pendingOwner;
    address public operator;
    
    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);

    constructor(){
        owner = msg.sender;
    }

    function getName() external pure returns (string memory) {
        return "FraxtalVoterProxy";
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

    //set operator which has execute functions of this contract
    function setOperator(address _operator) external {
        require(msg.sender == owner, "!auth");
        require(operator == address(0) || IDeposit(operator).isShutdown() == true, "needs shutdown");
        
        //require isshutdown interface
        require(IDeposit(_operator).isShutdown() == false, "no shutdown interface");
        
        operator = _operator;
    }

    //Simplified version that only allows execute from the operator and no helper functions
    //depositor will need to send requests via the booster
    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory) {
        require(msg.sender == operator,"!auth");

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

}