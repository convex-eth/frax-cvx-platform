// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';


contract cvxToken is ERC20 {

    address public owner;
    mapping(address => bool) public operators;
    event SetOperator(address indexed _op, bool _valid);

    constructor(string memory _name, string memory _symbol, address _owner)
        ERC20(
            _name,
            _symbol
        )
    {
        owner = _owner;
    }

    function setOperator(address _operator, bool _valid) external {
        require(msg.sender == owner, "!auth");
        operators[_operator] = _valid;
        emit SetOperator(_operator, _valid);
    }

    //remove ownership
    function revokeOwnership() external{
        require(msg.sender == owner, "!auth");
        owner = address(0);
    }
    
    function mint(address _to, uint256 _amount) external {
        require(operators[msg.sender], "!authorized");
        
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external {
        require(operators[msg.sender], "!authorized");
        
        _burn(_from, _amount);
    }

}