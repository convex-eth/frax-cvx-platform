// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;


import "./interfaces/IStaker.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


/*
This is a temporary contract for minimal requirements to deploy cvxFXS before
the staking platform is complete
*/
contract BoosterPlaceholder{
    using SafeERC20 for IERC20;

    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);

    address public immutable proxy;
    address public owner;
    bool public isShutdown;
    address public feeQueue;

    event Recovered(address _token, uint256 _amount);

    constructor(address _proxy) {
        proxy = _proxy;
        isShutdown = false;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    //set owner
    function setOwner(address _owner) external onlyOwner{
        owner = _owner;
    }

    //set fee queue, a contract fees are moved to when claiming
    function setFeeQueue(address _queue) external onlyOwner{
        feeQueue = _queue;
    }
    
    //shutdown this contract.
    function shutdownSystem() external onlyOwner{
        isShutdown = true;
    }

    //claim fees - if set, move to a fee queue that rewards can pull from
    function claimFees(address _distroContract, address _token) external onlyOwner{
        if(feeQueue != address(0)){
            IStaker(proxy).claimFees(_distroContract, _token, feeQueue);
        }else{
            IStaker(proxy).claimFees(_distroContract, _token, address(this));
        }
    }

    //call vefxs checkpoint
    function checkpointFeeRewards(address _distroContract) external onlyOwner{
        IStaker(proxy).checkpointFeeRewards(_distroContract);
    }

    //recover tokens on this contract
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external onlyOwner{
        IERC20(_tokenAddress).safeTransfer(_withdrawTo, _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    //recover tokens on the proxy
    function recoverERC20FromProxy(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external onlyOwner{

        bytes memory data = abi.encodeWithSelector(bytes4(keccak256("transfer(address,uint256)")), _withdrawTo, _tokenAmount);
        IStaker(proxy).execute(_tokenAddress,uint256(0),data);

        emit Recovered(_tokenAddress, _tokenAmount);
    }

}