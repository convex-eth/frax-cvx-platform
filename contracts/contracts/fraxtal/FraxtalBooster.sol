// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;


import "../interfaces/IStaker.sol";
import "../interfaces/IRewardDistribution.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


/*
Main interface for the whitelisted proxy contract.

**This contract is meant to be able to be replaced for upgrade purposes. use IVoterProxy.operator() to always reference the current booster

*/
contract FraxtalBooster{
    using SafeERC20 for IERC20;

    address public immutable proxy;
    address public immutable vefxs;
    address public immutable vefxsfpis;
    address public owner;
    address public pendingOwner;
    address public voteDelegate;
    address public fxsDepositor;
    address public fpisLocker;
    address public vefxsRewardDistribution;
    address public vefxsFeeToken;
    address public cvxfxsRewardReceiver;
    address public extraRewardDistribution;
    address public bridgeReceiver;
    uint256 public platformVefxsFees;
    address public platformReceiver;
    bool public isShutdown;



    constructor(address _proxy, address _vefxs, address _vefxsfpis) {
        proxy = _proxy;
        vefxs = _vefxs;
        vefxsfpis = _vefxsfpis;
        isShutdown = false;
        owner = msg.sender;
        voteDelegate = msg.sender;    
    }

    /////// Owner Section /////////

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }
    modifier onlyDepositor() {
        require(fxsDepositor == msg.sender, "!deposit");
        _;
    }
    modifier onlyFpisLocker() {
        require(fpisLocker == msg.sender, "!locker");
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

    function setFxsDepositor(address _deposit) external onlyOwner{
        fxsDepositor = _deposit;
        emit SetFxsDepositor(_deposit);
    }

    function setFpisLocker(address _locker) external onlyOwner{
        fpisLocker = _locker;
        emit SetFpisLocker(_locker);
    }

    function setVefxsDistro(address _distro, address _feeToken, address _cvxFeeReceiver) external onlyOwner{
        require(_distro != address(0),"invalid");
        require(_feeToken != address(0),"invalid");
        require(_cvxFeeReceiver != address(0),"invalid");
        vefxsRewardDistribution = _distro;
        vefxsFeeToken = _feeToken;
        cvxfxsRewardReceiver = _cvxFeeReceiver;
        emit SetVefxsDistro(_distro, _feeToken, _cvxFeeReceiver);
    }

    function setExtraDistro(address _distro, address _bridgeReceiver) external onlyOwner{
        require(_distro != address(0),"invalid");
        require(vefxsFeeToken != address(0),"!feeToken");
        extraRewardDistribution = _distro;
        bridgeReceiver = _bridgeReceiver;
        IERC20(vefxsFeeToken).approve(extraRewardDistribution,type(uint256).max);
        emit SetExtraDistro(_distro,_bridgeReceiver);
    }

    function setFeeInfo(address _platformReceiver, uint256 _fee) external onlyOwner{
        require(_platformReceiver != address(0),"invalid receiver");
        require(_fee <= 1e17, "invalid fee");
        platformReceiver = _platformReceiver;
        platformVefxsFees = _fee;
        emit SetFeeInfo(_platformReceiver, _fee);
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

    //create a new lock
    function createLock(address _locker, uint256 _value, uint128 _unlockTime) external onlyOwner{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("createLock(address,uint256,uint128)")), proxy, _value, _unlockTime);
        _proxyCall(_locker,data);
    }

    //arbitrary execute
    function execute(address _to, bytes calldata _data) external onlyOwner{
        _proxyCall(_to,_data);
    }

    //////// End Owner Section ///////////

    //// Depositor ///
    function increaseAmount(uint256 _value, uint128 _lockIndex) external onlyDepositor{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("increaseAmount(uint256,uint128)")), _value, _lockIndex);
        _proxyCall(vefxs,data);
    }

    function increaseUnlockTime(uint128 _unlockTime, uint128 _lockIndex) external onlyDepositor{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("increaseUnlockTime(uint128,uint128)")), _unlockTime, _lockIndex);
        _proxyCall(vefxs,data);
    }

    function increaseFpisAmount(uint256 _value, uint128 _lockIndex) external onlyFpisLocker{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("increaseAmount(uint256,uint128)")), _value, _lockIndex);
        _proxyCall(vefxsfpis,data);
    }

    function increaseFpisUnlockTime(uint128 _unlockTime, uint128 _lockIndex) external onlyFpisLocker{
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("increaseUnlockTime(uint128,uint128)")), _unlockTime, _lockIndex);
        _proxyCall(vefxsfpis,data);
    }

    /// End Depositor ///



    //claim and distribute fees
    function claimFees() external {
        uint256 _balance = IERC20(vefxsFeeToken).balanceOf(proxy);
        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("getYield()")));
        _proxyCall(vefxsRewardDistribution,data);
        _balance = IERC20(vefxsFeeToken).balanceOf(proxy) - _balance;

        uint256 platformshare = _balance * platformVefxsFees / 10000; 
        data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), platformReceiver, platformshare);
        _proxyCall(vefxsFeeToken,data);
        emit ClaimFees(platformReceiver,platformshare);
        _balance -= platformshare;
        data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), cvxfxsRewardReceiver, _balance);
        _proxyCall(vefxsFeeToken,data);
        emit ClaimFees(cvxfxsRewardReceiver, _balance);

        //pull rewards from bridge
        uint256 bridgeBalance = IERC20(vefxsFeeToken).balanceOf(bridgeReceiver);
        data = abi.encodeWithSelector(bytes4(keccak256("withdrawTo(address,uint256,address)")),vefxsFeeToken,bridgeBalance,address(this));
        _proxyCall(bridgeReceiver,data);

        //enqueue rewards
        IRewardDistribution(extraRewardDistribution).queueNewRewards(bridgeBalance);

        //claim rewards
        data = abi.encodeWithSelector(bytes4(keccak256("getReward(address)")), address(this));
        _proxyCall(extraRewardDistribution,data);
        IERC20(vefxsFeeToken).safeTransfer(cvxfxsRewardReceiver, IERC20(vefxsFeeToken).balanceOf(address(this)));
    }

    /* ========== EVENTS ========== */
    event SetPendingOwner(address indexed _address);
    event SetFxsDepositor(address indexed _address);
    event SetFpisLocker(address indexed _address);
    event SetVefxsDistro(address indexed _vefxsdistro, address _token, address _receiver);
    event SetExtraDistro(address indexed _distro, address _bridgeReceiver);
    event SetFeeInfo(address indexed _platformreceiver, uint256 _fee);
    event ClaimFees(address indexed _receiver, uint256 _amount );
    event OwnerChanged(address indexed _address);
    event Shutdown();
    event DelegateSet(address indexed _address);
    event OnChainDelegateSet(address indexed _address);
    event Recovered(address indexed _token, uint256 _amount);
}