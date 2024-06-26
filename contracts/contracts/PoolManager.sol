// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IBooster.sol";
import "./interfaces/IVoterProxy.sol";
import "./interfaces/IFraxGaugeController.sol";
import "./interfaces/IFraxFarmERC20_V2.sol";

/*
Pool Manager
*/
contract PoolManager{

    address public immutable proxy;
    address public immutable gaugeController;

    mapping(string => mapping(string => address)) implementationMap; //type -> version -> implementation

    event PoolAdded(address indexed _gauge, address _implementation);
    event ImplementationAdded(string indexed gaugetype, string indexed version, address _gauge);

    constructor(address _proxy, address _gaugeController){
        proxy = _proxy;
        gaugeController = _gaugeController;
    }

    modifier onlyOwner() {
        require(IBooster(_currentBooster()).owner() == msg.sender, "!owner");
        _;
    }

    function _currentBooster() internal view returns(address){
        return IVoterProxy(proxy).operator();
    }

    //set implementation for given type and version
    function addImplementation(address _impl, string calldata _type, string calldata _version) external onlyOwner{
        implementationMap[_type][_version] = _impl;
        emit ImplementationAdded(_type, _version, _impl);
    }

    //set a new reward pool implementation for future pools
    function setPoolRewardImplementation(address _impl) external onlyOwner{
        IBooster(_currentBooster()).setPoolRewardImplementation(_impl);
    }

    //deactivate a pool
    function deactivatePool(uint256 _pid) external onlyOwner{
        IBooster(_currentBooster()).deactivatePool(_pid);
    }

    //set extra reward contracts to be active when pools are created
    function setRewardActiveOnCreation(bool _active) external onlyOwner{
        IBooster(_currentBooster()).setRewardActiveOnCreation(_active);
    }

    //add a new pool
    function addPool(uint256 _gaugeIndex) external returns(bool){
        //get gauge from gauge controller. only properly added gauges can be found
        address gauge = IFraxGaugeController(gaugeController).gauges(_gaugeIndex);
        require(gauge != address(0),"!gauge");

        //check that gauge is not shutdown or unlocked
        require(
            !IFraxFarmERC20_V2(gauge).withdrawalOnlyShutdown()
            && !IFraxFarmERC20_V2(gauge).stakesUnlocked()
            ,"invalid pool state");

        //get version and type from gauge
        string memory ver = IFraxFarmERC20_V2(gauge).version();
        string memory gaugetype = IFraxFarmERC20_V2(gauge).farm_type();

        //get impl for version and type
        address implementation = implementationMap[gaugetype][ver];
        require(implementation != address(0),"!implementation");

        //get staking token
        address stakingToken = IFraxFarmERC20_V2(gauge).stakingToken();

        //add pool
        IBooster(_currentBooster()).addPool(implementation, gauge, stakingToken);
        emit PoolAdded(gauge, implementation);
        return true;
    }

}