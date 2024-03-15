// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;


import "../interfaces/IStaker.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


/*
Main interface for the whitelisted proxy contract.

**This contract is meant to be able to be replaced for upgrade purposes. use IVoterProxy.operator() to always reference the current booster

*/
contract FraxtalBooster{
    using SafeERC20 for IERC20;

    // address public constant fxs = address();

    address public immutable proxy;
    address public owner;
    address public pendingOwner;
    address public voteDelegate;
    bool public isShutdown;



    constructor(address _proxy) {
        proxy = _proxy;
        isShutdown = false;
        owner = msg.sender;
        voteDelegate = msg.sender;
    }

    /////// Owner Section /////////

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    //set pending owner
    function setPendingOwner(address _po) external onlyOwner{
        pendingOwner = _po;
        emit SetPendingOwner(_po);
    }

    function _proxyCall(address _to, bytes memory _data) internal{
        (bool success,) = IStaker(proxy).execute(_to,uint256(0),_data);
        require(success, "Proxy Call Fail");
    }

    //claim ownership
    function acceptPendingOwner() external {
        require(pendingOwner != address(0) && msg.sender == pendingOwner, "!p_owner");

        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnerChanged(owner);
    }

    //shutdown this contract.
    function shutdownSystem() external onlyOwner{
        //This version of booster does not require any special steps before shutting down
        //and can just immediately be set.
        isShutdown = true;
        emit Shutdown();
    }

    //set snapshot voting delegate
    function setDelegate(address _delegateContract, address _delegate, bytes32 _space) external onlyOwner{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("setDelegate(bytes32,address)")), _space, _delegate);
        _proxyCall(_delegateContract,data);
        emit DelegateSet(_delegate);
    }

    //set on chain governance voting delegate
    function setOnChainDelegate(address _delegateContract, address _delegate) external onlyOwner{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("delegate(address)")), _delegate);
        _proxyCall(_delegateContract,data);
        voteDelegate = _delegate;
        emit OnChainDelegateSet(_delegate);
    }

    function castVote(address _votingContract, uint256 _proposalId, bool _support) external{
        require(msg.sender == voteDelegate, "!voteDelegate");
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("castVote(uint256,uint8)")), _proposalId, _support?uint8(1):uint8(0));
        _proxyCall(_votingContract,data);
    }

    //recover tokens on this contract
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external onlyOwner{
        IERC20(_tokenAddress).safeTransfer(_withdrawTo, _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    //recover tokens on the proxy
    function recoverERC20FromProxy(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external onlyOwner{

        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), _withdrawTo, _tokenAmount);
        _proxyCall(_tokenAddress,data);

        emit Recovered(_tokenAddress, _tokenAmount);
    }

    //arbitrary execute
    function execute(address _to, bytes calldata _data) external onlyOwner{
        _proxyCall(_to,_data);
    }

    //////// End Owner Section ///////////

    
    /* ========== EVENTS ========== */
    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);
    event Shutdown();
    event DelegateSet(address indexed _address);
    event OnChainDelegateSet(address indexed _address);
    event Recovered(address indexed _token, uint256 _amount);
}