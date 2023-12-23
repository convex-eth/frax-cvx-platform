// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IVoterProxy.sol";
import "./interfaces/IBooster.sol";
import "./interfaces/IFxsDepositor.sol";
import "./interfaces/ICurveExchange.sol";
import "./interfaces/IConvexVault.sol";
import "./interfaces/IERC4626.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

interface wrappedSteth{
    function unwrap(uint256 _wstETHAmount) external returns (uint256);
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
}

/*
 Treasury module for cvx/frxeth lp management on Frax farms
*/
contract TreasuryManagerFrax{
    using SafeERC20 for IERC20;

    address public constant crv = address(0xD533a949740bb3306d119CC777fa900bA034cd52);
    address public constant cvx = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant frxeth = address(0x5E8422345238F34275888049021821E8E08CAa1f);
    address public constant sfrxeth = address(0xac3E018457B222d93114458476f3E3416Abbe38F);
    address public constant treasury = address(0x1389388d01708118b497f59521f6943Be2541bb7);
    address public constant curvepool = address(0x47D5E1679Fe5f0D9f0A657c6715924e33Ce05093);
    address public constant lptoken = address(0x6e52cCe4EaFDf77091dD1c82183b2D97b776b397);
    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);

    uint256 public constant pid = 53; //Convex CVX/frxETH

    address public constant stethfrxeth = address(0x4d9f9D15101EEC665F77210cB999639f760F831E);
    address public constant steth = address(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);
    address public constant wsteth = address(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);

    address public immutable owner;


    mapping(address => bool) public operators;
    mapping(uint256 => bytes32) public kekmap;
    uint256 public slippage;
    address public vault;

    event OperatorSet(address indexed _op, bool _active);
    event Swap(uint256 _amount);
    event Convert(uint256 _amount);
    event AddedToLP(bytes32 _kekid, uint256 _lpamount);
    event IncreaseLock(bytes32 _kekid, uint256 _timestamp);
    event RemovedFromLp(bytes32 _kekid);
    event ClaimedReward(address indexed _token, uint256 _amount);

    constructor() {
        owner = address(0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB);
        operators[msg.sender] = true;

        slippage = 997 * 1e15;
        IERC20(frxeth).safeApprove(curvepool, type(uint256).max);
        IERC20(frxeth).safeApprove(sfrxeth, type(uint256).max);
        IERC20(cvx).safeApprove(curvepool, type(uint256).max);
        IERC20(steth).safeApprove(stethfrxeth, type(uint256).max);


        //create vault
        vault = IBooster(IVoterProxy(vefxsProxy).operator()).createVault(pid);
        IERC20(lptoken).safeApprove(vault, type(uint256).max);
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender] || owner == msg.sender, "!operator");
        _;
    }

    function balanceOfCvx() external view returns(uint256){
        return IERC20(cvx).balanceOf(address(this));
    }

    function treasuryBalanceOfFrxEth() external view returns(uint256){
        return IERC20(frxeth).balanceOf(treasury);
    }
    
    function treasuryBalanceOfSFrxEth() external view returns(uint256){
        return IERC20(sfrxeth).balanceOf(treasury);
    }

    function treasuryBalanceOfWstEth() external view returns(uint256){
        return IERC20(wsteth).balanceOf(treasury);
    }

    function setOperator(address _op, bool _active) external onlyOwner{
        operators[_op] = _active;
        emit OperatorSet(_op, _active);
    }

    function setSlippageAllowance(uint256 _slip) external onlyOwner{
        require(_slip > 0, "!valid slip");
        slippage = _slip;
    }

    function withdrawTo(IERC20 _asset, uint256 _amount, address _to) external onlyOwner{
        _asset.safeTransfer(_to, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external onlyOwner returns (bool, bytes memory) {

        (bool success, bytes memory result) = _to.call{value:_value}(_data);

        return (success, result);
    }

    function calc_minOut_deposit(uint256 _sfrxethAmount, uint256 _frxethAmount, uint256 _cvxAmount) external view returns(uint256){
        if(_sfrxethAmount > 0){
            //get redeemable frxeth amount and add to _frxethAmount
            _frxethAmount += IERC4626(sfrxeth).previewRedeem(_sfrxethAmount);
        }

        uint256[2] memory amounts = [_frxethAmount,_cvxAmount];
        uint256 tokenOut = ICurveExchange(curvepool).calc_token_amount(amounts);
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function calc_withdraw_one_coin(uint256 _amount) external view returns(uint256){
        uint256 tokenOut = ICurveExchange(curvepool).calc_withdraw_one_coin(_amount, uint256(1));
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function calc_minOut_swap(uint256 _amount) external view returns(uint256){
        //convert wsteth amount to steth
        _amount = wrappedSteth(wsteth).getStETHByWstETH(_amount);
        
        uint256[2] memory amounts = [_amount,0];
        uint256 tokenOut = ICurveExchange(stethfrxeth).calc_token_amount(amounts, false);
        tokenOut = tokenOut * slippage / 1e18;
        return tokenOut;
    }

    function swapWStethToFrxEth(uint256 _amount, uint256 _minAmountOut, bool _returnStaked) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //pull
        IERC20(wsteth).safeTransferFrom(treasury,address(this),_amount);
        //unwrap
        wrappedSteth(wsteth).unwrap(_amount);
        
        if(_returnStaked){
            //swap steth for frxeth
            ICurveExchange(stethfrxeth).exchange(0,1,IERC20(steth).balanceOf(address(this)),_minAmountOut, address(this));
            //deposit for treasury
            IERC4626(sfrxeth).deposit(IERC20(frxeth).balanceOf(address(this)), treasury);
        }else{
            //swap steth for frxeth and return to treasury
            ICurveExchange(stethfrxeth).exchange(0,1,IERC20(steth).balanceOf(address(this)),_minAmountOut, treasury);
        }

        emit Swap(_amount);
    }


    function addToPool(uint256 _sfrxethAmount, uint256 _frxethAmount, uint256 _cvxAmount, uint256 _minAmountOut, uint256 _slot, uint256 _time) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //pull (cvx should be sent directly, not have pull access)
        if(_frxethAmount > 0){
            IERC20(frxeth).safeTransferFrom(treasury,address(this),_frxethAmount);
        }

        if(_sfrxethAmount > 0){
            //pull sfrxeth and redeem
            IERC20(sfrxeth).safeTransferFrom(treasury,address(this),_sfrxethAmount);
            IERC4626(sfrxeth).redeem(IERC4626(sfrxeth).maxRedeem(address(this)), address(this), address(this));
            //update frxeth amount to use
            _frxethAmount = IERC20(frxeth).balanceOf(address(this));
        }

        //add lp
        uint256[2] memory amounts = [_frxethAmount,_cvxAmount];
        ICurveExchange(curvepool).add_liquidity(amounts, _minAmountOut, false, address(this));

        //add to convex
        uint256 lpBalance = IERC20(lptoken).balanceOf(address(this));

        bytes32 kek = kekmap[_slot];
        if(kek == bytes32(0)){
            //new lock
            kekmap[_slot] = IConvexVault(vault).stakeLockedCurveLp(lpBalance, _time);
        }else{
            //add to current lock
            IConvexVault(vault).lockAdditionalCurveLp(kek, lpBalance);
        }

        emit AddedToLP(kekmap[_slot], lpBalance);
    }

    function lockLonger(uint256 _slot, uint256 _new_ending_ts) external onlyOperator{
        //set longer end time
        IConvexVault(vault).lockLonger(kekmap[_slot], _new_ending_ts);

        emit AddedToLP(kekmap[_slot], _new_ending_ts);
    }

    function removeFromPool(uint256 _slot, uint256 _minAmountOut) external onlyOperator{
        require(_minAmountOut > 0, "!min_out");

        //remove from convex vault
        IConvexVault(vault).withdrawLockedAndUnwrap(kekmap[_slot]);

        //reset kek map as this locked state should be removed on farm side
        kekmap[_slot] = bytes32(0);

        //remove from LP with treasury as receiver, cvx = coins[1]
        ICurveExchange(curvepool).remove_liquidity_one_coin(IERC20(lptoken).balanceOf(address(this)), uint256(1), _minAmountOut, false, treasury);

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
        }

        bal = IERC20(fxs).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(fxs).safeTransfer(treasury, bal);
        }

        emit RemovedFromLp(kekmap[_slot]);
    }

    function removeAsLP(uint256 _slot) external onlyOperator{
        //remove from convex vault
        IConvexVault(vault).withdrawLockedAndUnwrap(kekmap[_slot]);

        //reset kek map as this locked state should be removed on farm side
        kekmap[_slot] = bytes32(0);

        //remove from LP with treasury as receiver
        IERC20(lptoken).safeTransfer(treasury,IERC20(lptoken).balanceOf(address(this)));

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
        }

        bal = IERC20(fxs).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(fxs).safeTransfer(treasury, bal);
        }

        emit RemovedFromLp(kekmap[_slot]);
    }


     function claimLPRewards() external onlyOperator{
        //claim from convex
        IConvexVault(vault).getReward();

        uint256 bal = IERC20(crv).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(crv).safeTransfer(treasury, bal);
            emit ClaimedReward(crv,bal);
        }

        bal = IERC20(cvx).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(cvx).safeTransfer(treasury, bal);
            emit ClaimedReward(cvx,bal);
        }

        bal = IERC20(fxs).balanceOf(address(this));
        if(bal > 0){
            //transfer to treasury
            IERC20(fxs).safeTransfer(treasury, bal);
            emit ClaimedReward(fxs,bal);
        }
    }

}