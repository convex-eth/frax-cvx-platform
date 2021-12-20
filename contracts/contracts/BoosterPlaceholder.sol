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

    event Recovered(address _token, uint256 _amount);

    constructor(address _proxy) {
        proxy = _proxy;
        isShutdown = false;
        owner = msg.sender;
    }

    function setOwner(address _owner) external {
        require(msg.sender == owner, "!auth");
        owner = _owner;
    }
    
    //shutdown this contract.
    function shutdownSystem() external{
        require(msg.sender == owner, "!auth");
        isShutdown = true;
    }

    function claimFees(address _distroContract, address _token) external{
        require(msg.sender == owner, "!auth");

        IStaker(proxy).claimFees(_distroContract, _token);
    }

    function checkpointFeeRewards(address _distroContract) external{
        require(msg.sender == owner, "!auth");

        IStaker(proxy).checkpointFeeRewards(_distroContract);
    }

    function recoverERC20(address _tokenAddress, uint256 _tokenAmount, address _withdrawTo) external {
        require(msg.sender == owner, "!auth");

        IERC20(_tokenAddress).safeTransfer(_withdrawTo, _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

}