// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[ERC section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IOptimismMintableERC20 is IERC165 {
    function remoteToken() external view returns (address);

    function bridge() external returns (address);

    function mint(address _to, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;
}

contract cvxToken is ERC20,IOptimismMintableERC20 {

    address public owner;
    address immutable public remoteToken;
    address immutable public bridge;
    mapping(address => bool) public operators;
    event SetOperator(address indexed _op, bool _valid);

    constructor(string memory _name, string memory _symbol, address _owner, address _remoteToken, address _bridge)
        ERC20(
            _name,
            _symbol
        )
    {
        owner = _owner;
        remoteToken = _remoteToken;
        bridge = _bridge;
    }

    /// @notice ERC165 interface check function.
    /// @param _interfaceId Interface ID to check.
    /// @return Whether or not the interface is supported by this contract.
    function supportsInterface(bytes4 _interfaceId) external pure virtual returns (bool) {
        bytes4 iface1 = type(IERC165).interfaceId;
        // Interface corresponding to the updated OptimismMintableERC20 (this contract).
        bytes4 iface2 = type(IOptimismMintableERC20).interfaceId;
        return _interfaceId == iface1 || _interfaceId == iface2;
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