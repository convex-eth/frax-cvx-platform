// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IProxyFactory.sol";

contract PoolRegistry {

    address public constant owner = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant proxyFactory = address(0x66807B5598A848602734B82E432dD88DBE13fC8f);

    address public operator;
    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => address)) public vaultMap; //pool -> user -> vault
    
    struct PoolInfo {
        address implementation;
        address stakingAddress;
        address stakingToken;
        uint8 active;
    }

    event PoolCreated(uint256 indexed poolid, address indexed implementation, address stakingAddress, address stakingToken);
    event PoolDeactivated(uint256 indexed poolid);
    event AddUserVault(address indexed user, uint256 indexed poolid);

    constructor() {}

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "!op auth");
        _;
    }

    function setOperator(address _op) external onlyOwner{
        operator = _op;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    //add a new pool and implementation
    function addPool(address _implementation, address _stakingAddress, address _stakingToken) external onlyOperator{
        require(_implementation != address(0), "!imp");
        require(_stakingAddress != address(0), "!stkAdd");
        require(_stakingToken != address(0), "!stkTok");

        poolInfo.push(
            PoolInfo({
                implementation: _implementation,
                stakingAddress: _stakingAddress,
                stakingToken: _stakingToken,
                active: 1
            })
        );
        emit PoolCreated(poolInfo.length-1, _implementation, _stakingAddress, _stakingToken);
    }

    //deactivates pool so that new vaults can not be made.
    //can not force shutdown/withdraw user funds
    function deactivatePool(uint256 _pid) external onlyOperator{
        poolInfo[_pid].active = 0;
        emit PoolDeactivated(_pid);
    }

    //clone a new user vault
    function addUserVault(uint256 _pid, address _user) external onlyOperator returns(address vault, address stakingAddress, address stakingToken){
        require(vaultMap[_pid][_user] == address(0), "already exists");

        PoolInfo storage pool = poolInfo[_pid];
        require(pool.active > 0, "!active");

        vault = IProxyFactory(proxyFactory).clone(pool.implementation);
        vaultMap[_pid][_user] = vault;
        stakingAddress = pool.stakingAddress;
        stakingToken = pool.stakingToken;

        emit AddUserVault(_user, _pid);
    }
    
}
