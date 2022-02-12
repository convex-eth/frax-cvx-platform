// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;



contract PoolRegistry {

    
    address public operator;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => address)) public vaultMap; //pool -> user -> vault
    
    struct PoolInfo {
        address implementation;
        address stakingAddress;
        address stakingToken;
    }

    constructor(address _operator) {
        operator = _operator;
    }

    function addPool(address _implementation, address _stakingAddress, address _stakingToken) external{
        require(msg.sender == operator,"!auth");

        poolInfo.push(
            PoolInfo({
                implementation: _implementation,
                stakingAddress: _stakingAddress,
                stakingToken: _stakingToken
            })
        );
    }

    
}
