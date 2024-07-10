// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ICvxFxb.sol";
import "../interfaces/IFraxLend.sol";
import "../interfaces/IRewardReceiver.sol";
import "../interfaces/ICurveExchange.sol";

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


//swap frax for fxb and return to cvxfxb
contract cvxFXBSwapper is IRewardReceiver{
    using SafeERC20 for IERC20;

    address public immutable fxb;
    address public immutable frax;
    address public immutable cvxfxb;
    address public immutable fraxlend;
    address public immutable exchange;
    uint256 public constant EXCHANGE_PRECISION = 1e18;

    address public owner;
    address public pendingOwner;

    uint256 public slippage;
    //events
    event SetSlippage(uint256 _slippage);
    event Swapped(uint256 _amountin, uint256 _maxout);
    event SetPendingOwner(address indexed _address);
    event OwnerChanged(address indexed _address);
    

    constructor(address _cvxfxb, address _fxb, address _frax, address _fraxlend, address _exchange){
        cvxfxb = _cvxfxb;
        fxb = _fxb;
        frax = _frax;
        fraxlend = _fraxlend;
        exchange = _exchange;
        owner = msg.sender;

        slippage = 990 * 1e15;

        IERC20(frax).approve(exchange, type(uint256).max);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!o_auth");
        _;
    }

    //set pending owner
    function setPendingOwner(address _po) external onlyOwner{
        pendingOwner = _po;
        emit SetPendingOwner(_po);
    }

    //claim ownership
    function acceptPendingOwner() external {
        require(pendingOwner != address(0) && msg.sender == pendingOwner, "!p_owner");

        owner = pendingOwner;
        pendingOwner = address(0);
        emit OwnerChanged(owner);
    }

    function setSlippage(uint256 _slippage) external onlyOwner{
        slippage = _slippage;
        emit SetSlippage(_slippage);
    }

    //swap frax for fxb
    //use oracle as a basis for setting min amount out
    function processRewards() external{
        //get available frax
        uint256 fbal = IERC20(frax).balanceOf(address(this));

        //get exchange rate based on oracle
        (,,uint256 exchangeRate) = IFraxLend(fraxlend).updateExchangeRate();
        
        //set a minimum out based on oracle rate and slippage settings
        uint256 minOut = fbal * exchangeRate / EXCHANGE_PRECISION;
        minOut = minOut * slippage / 1e18;
        
        //exchange with result going back to cvxfxb
        ICurveExchange(exchange).exchange(0,1,fbal,minOut, cvxfxb);

        emit Swapped(fbal,minOut);
    }

}