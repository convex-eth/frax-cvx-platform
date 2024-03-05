// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IConvexWrapperV2.sol";
import "./interfaces/IFraxFarmERC20.sol";
import "./interfaces/IRewards.sol";
import "./interfaces/IPoolRegistry.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


/*
This is a simple registry for certain pool types used for UI display
*/
contract PoolTypes{
    address public constant convexProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant vefxs = address(0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0);
    address public constant poolRegistry = address(0x41a5881c17185383e19Df6FA4EC158a6F4851A69);

    mapping(uint256 => uint256) public poolType; //poolid -> type
    mapping(uint256 => string) public typeName; //type -> description

    address public immutable owner;
    mapping(address => bool) public operators;

    event OperatorSet(address indexed _op, bool _active);
    event SetTypeName(uint256 indexed _type, string _name);
    event SetPoolType(uint256 indexed _pool, uint256 _type);

    constructor() {
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operators[msg.sender] = true;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || owner == msg.sender, "!operator");
        _;
    }

    function setOperator(address _op, bool _active) external onlyOwner{
        operators[_op] = _active;
        emit OperatorSet(_op, _active);
    }

    function setTypeName(uint256 _type, string calldata _name) external onlyOperator{
        typeName[_type] = _name;
        emit SetTypeName(_type, _name);
    }

    function setPoolType(uint256 _pool, uint256 _type) external onlyOperator{
        poolType[_pool] = _type;
        emit SetPoolType(_pool, _type);
    }

}
