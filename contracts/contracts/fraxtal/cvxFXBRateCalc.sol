// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/ICvxFxb.sol";
import "../interfaces/IFraxLend.sol";
import "../interfaces/IStakedFrax.sol";
import "../interfaces/IRateCalculatorV2.sol";


//calculate utilization bounds for cvxfxb
contract cvxFXBRateCalc{

    address public immutable cvxfxb;
    address public immutable sfrax;
    address public immutable fraxlend;
    uint256 public constant UTIL_PREC = 100000;
    uint256 public constant UTIL_CAP = 99000; //dont let util go to 100%
    uint256 public constant RATE_STEP = 1000;
    uint256 public constant REWARDS_CYCLE_LENGTH = 604800;


    constructor(address _cvxfxb, address _sfrax, address _fraxlend){
        cvxfxb = _cvxfxb;
        sfrax = _sfrax;
        fraxlend = _fraxlend;
    }

    function fraxlendCurrentUtil() external view returns(uint256 currentUtil){
        uint256 totalassets = IFraxLend(fraxlend).totalAssets();
        (uint256 totalborrow,) = IFraxLend(fraxlend).totalBorrow();
        currentUtil = totalassets == 0
                ? 0
                : (UTIL_PREC * totalborrow) / totalassets;
    }

    function sfraxRates() public view returns(uint256 fraxPerSecond){
        IStakedFrax.RewardsCycleData memory rdata = IStakedFrax(sfrax).rewardsCycleData();
        uint256 sfraxtotal = IStakedFrax(sfrax).storedTotalAssets();
        uint256 maxsfraxDistro = IStakedFrax(sfrax).maxDistributionPerSecondPerAsset();
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
        if(current > high){
            //also check if low is better than current
            //should never be a situation where low is better than high but current isnt
            useUtil = low > current ? lowUtil : currentUtil;
        }
    }

    //force update to utilization bounds
    function update() external{
        ICvxFxb(cvxfxb).setUtilBounds(calcUtilBounds());
    }
}