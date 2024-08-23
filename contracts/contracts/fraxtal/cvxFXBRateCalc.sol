// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ICvxFxb.sol";
import "../interfaces/IFraxLend.sol";
import "../interfaces/IStakedFrax.sol";
import "../interfaces/IRateCalculatorV2.sol";
import "../interfaces/IDualOracle.sol";

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


//calculate utilization bounds for cvxfxb
contract cvxFXBRateCalc{

    address public immutable cvxfxb;
    address public immutable frax;
    address public immutable sfrax;
    address public immutable fraxlend;
    uint256 public constant UTIL_PREC = 100000;
    uint256 public constant UTIL_CAP = 99000; //dont let util go to 100%
    uint256 public constant RATE_STEP = 1000;
    uint256 public constant REWARDS_CYCLE_LENGTH = 604800;
    uint256 public constant BORROW_MORE_DIFF = 1e18+1e15;

    uint256 public minimumUtil = 90000;
    event SetMinimumUtil(uint256 _minimum);

    constructor(address _cvxfxb, address _frax, address _sfrax, address _fraxlend){
        cvxfxb = _cvxfxb;
        frax = _frax;
        sfrax = _sfrax;
        fraxlend = _fraxlend;
    }

    modifier onlyOwner() {
        require(ICvxFxb(cvxfxb).owner() == msg.sender, "!o_auth");
        _;
    }

    //set minimum util
    function setMinimumUtil(uint256 _minimum) external onlyOwner{
        minimumUtil = _minimum;
        emit SetMinimumUtil(_minimum);
    }

    function fraxlendCurrentUtil() public view returns(uint256 currentUtil){
        uint256 totalassets = IFraxLend(fraxlend).totalAssets();
        (uint256 totalborrow,) = IFraxLend(fraxlend).totalBorrow();
        currentUtil = totalassets == 0
                ? 0
                : (UTIL_PREC * totalborrow) / totalassets;
    }

    function currentRatesPerSupply() external view returns(uint256 currentrates){
        address rateContract = IFraxLend(fraxlend).rateContract();
        IFraxLend.CurrentRateInfo memory rateInfo = IFraxLend(fraxlend).currentRateInfo();

        (uint256 lendrate,) = IRateCalculatorV2(rateContract).getNewRate(
                0,
                fraxlendCurrentUtil(),
                rateInfo.fullUtilizationRate
            );

        currentrates = sfraxRates();
        currentrates = currentrates > lendrate ? currentrates-lendrate : 0;

        //get current borrow amount
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(cvxfxb);
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);

        //total rate
        currentrates *= borrowamount;
        uint256 supply = IERC20(cvxfxb).totalSupply();
        if(supply == 0){
            return 0;
        }

        currentrates = currentrates / IERC20(cvxfxb).totalSupply();
    }

    function sfraxRates() public view returns(uint256 fraxPerSecond){
        address pricefeed = IStakedFrax(sfrax).priceFeedVault();
        IStakedFrax.RewardsCycleData memory rdata = IStakedFrax(pricefeed).rewardsCycleData();
        uint256 sfraxtotal = IStakedFrax(pricefeed).storedTotalAssets();
        uint256 maxsfraxDistro = IStakedFrax(pricefeed).maxDistributionPerSecondPerAsset();
        fraxPerSecond = rdata.rewardCycleAmount / REWARDS_CYCLE_LENGTH;
        fraxPerSecond = fraxPerSecond * 1e18 / sfraxtotal;
        fraxPerSecond = fraxPerSecond > maxsfraxDistro ? maxsfraxDistro : fraxPerSecond;
    }

    function fraxlendRates() public view returns(uint256 lowRate, uint256 currentRate, uint256 highRate, uint256 lowUtil, uint256 currentUtil, uint256 highUtil){
        address rateContract = IFraxLend(fraxlend).rateContract();
        
        IFraxLend.CurrentRateInfo memory rateInfo = IFraxLend(fraxlend).currentRateInfo();

        currentUtil = ICvxFxb(cvxfxb).utilBound();

        lowUtil = RATE_STEP >= currentUtil ? 0 : currentUtil - RATE_STEP;
        highUtil = currentUtil + RATE_STEP > UTIL_CAP ? UTIL_CAP : currentUtil + RATE_STEP;

        (lowRate,) = IRateCalculatorV2(rateContract).getNewRate(
                0,
                lowUtil,
                rateInfo.fullUtilizationRate
            );
        (currentRate,) = IRateCalculatorV2(rateContract).getNewRate(
                0,
                currentUtil,
                rateInfo.fullUtilizationRate
            );
        (highRate,) = IRateCalculatorV2(rateContract).getNewRate(
                0,
                highUtil,
                rateInfo.fullUtilizationRate
            );
    }

    function rewardsPerSecond() public view returns(uint256 low, uint256 current, uint256 high, uint256 lowUtil, uint256 currentUtil, uint256 highUtil){

        //sfrax rates
        uint256 fRate = sfraxRates();

        uint256 lowRate;
        uint256 currentRate;
        uint256 highRate;
        {
            //fraxlend rates
            (uint256 lRate, uint256 cRate, uint256 hRate, uint256 lUtil, uint256 cUtil, uint256 hUtil) = fraxlendRates();
            lowRate = lRate;
            currentRate = cRate;
            highRate = hRate;
            lowUtil = lUtil;
            currentUtil = cUtil;
            highUtil = hUtil;
        }

        //get borrowable amounts at each util level
        (,,,,IFraxLend.VaultAccount memory totalAsset, ) = IFraxLend(fraxlend).previewAddInterest();

        //get how much is borrowed at a given utilization rate
        //can use whole pool's utilization since everyone has same rates
        uint256 borrowablelow = totalAsset.amount * lowUtil / UTIL_PREC;
        uint256 borrowablecurrent = totalAsset.amount * currentUtil / UTIL_PREC;
        uint256 borrowablehigh = totalAsset.amount * highUtil / UTIL_PREC;

        //add borrowable amounts to rates to get cost per second
        lowRate *= borrowablelow;
        currentRate *= borrowablecurrent;
        highRate *= borrowablehigh;

        //get frax revenue per second for each range
        borrowablelow = fRate * borrowablelow;
        borrowablecurrent = fRate * borrowablecurrent;
        borrowablehigh = fRate * borrowablehigh;
        
        //difference between fee and revenue
        low = borrowablelow > lowRate ? borrowablelow - lowRate : 0;
        current = borrowablecurrent > currentRate ? borrowablecurrent - currentRate : 0;
        high = borrowablehigh > highRate ? borrowablehigh - highRate : 0;
    }

    //calculate what util bounds should be used
    function calcUtilBounds() public view returns(uint256 useUtil){
        
        (uint256 low, uint256 current, uint256 high, uint256 lowUtil, uint256 currentUtil, uint256 highUtil) = rewardsPerSecond();
        //default to higher setting
        useUtil = highUtil;

        //check if current is better than high
        if(current >= high){
            //also check if low is better than current
            //should never be a situation where low is better than high but current isnt
            useUtil = low >= current ? lowUtil : currentUtil;
        }

        //if positive rates, clamp to a minimum util
        if(useUtil < minimumUtil && current > 0){
            useUtil = minimumUtil;
        }
    }

    //helper function to check if updateBalances() should be called
    function calcBorrowUpdate() public view returns(bool){
        //check if paused locally
        if(ICvxFxb(cvxfxb).isPaused()){
            return false;
        }

        //check if we have frax or fxb to deposit
        if(IERC20(frax).balanceOf(cvxfxb) > 0){
            return true;
        }
        if(IERC20(ICvxFxb(cvxfxb).stakingToken()).balanceOf(cvxfxb) > 0){
            return true;
        }

        
        //get max borrow and bounds
        uint256 maxborrow = ICvxFxb(cvxfxb).maxBorrowable(ICvxFxb(cvxfxb).totalAssets(), ICvxFxb(cvxfxb).utilBound());
        uint256 bbound = maxborrow * ICvxFxb(cvxfxb).borrowBound() / UTIL_PREC;
        uint256 rbound = maxborrow * ICvxFxb(cvxfxb).repayBound() / UTIL_PREC;

        //get current borrow amount
        uint256 borrowshares = IFraxLend(fraxlend).userBorrowShares(cvxfxb);
        uint256 borrowamount = IFraxLend(fraxlend).toBorrowAmount(borrowshares,true,true);
        
        if(borrowamount > rbound){
            //need to repay/reduce
            return true;
        }else if(bbound * 1e18 / borrowamount >= BORROW_MORE_DIFF ){

            //check oracle conditions for borrowing more directly from oracle to keep as a view function
            //otherwise could call fraxlend.updateExchangeRate() and use isBorrowAllowed
            IFraxLend.ExchangeRateInfo memory exInfo = IFraxLend(fraxlend).exchangeRateInfo();
            (,uint256 lowexchangeRate,uint256 highexchangeRate) = IDualOracle(exInfo.oracle).getPrices();
            uint256 _deviation = (UTIL_PREC *
                (highexchangeRate - lowexchangeRate)) /
                highexchangeRate;
            if (_deviation > exInfo.maxOracleDeviation) {
                return false;
            }

            //can borrow more
            return true;
        }

        //no need to update now
        return false;
    }

    function needsUpdate() external view returns(bool){
        return 
        ICvxFxb(cvxfxb).utilBound() != calcUtilBounds() 
        ||
        calcBorrowUpdate();
    }

    //update wrapper
    function update() external{
        //calling update balances will also callback to here for util bounds
        ICvxFxb(cvxfxb).updateBalances();
    }
}