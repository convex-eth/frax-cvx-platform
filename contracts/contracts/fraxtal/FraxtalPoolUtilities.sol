// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "../interfaces/IFraxtalVeFxsRewardDistro.sol";
import "../interfaces/IFraxtalVoteEscrow.sol";
import "../interfaces/IRewardStaking.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


/*
This is a utility library which is mainly used for off chain calculations
*/
contract FraxtalPoolUtilities{
    address public constant convexProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant fxs = address(0xFc00000000000000000000000000000000000002);
    address public constant vefxs = address(0x007FD070a7E1B0fA1364044a373Ac1339bAD89CF);
    address public constant vefxsRewards = address(0x21359d1697e610e25C8229B2C57907378eD09A2E);
    address public constant stkCvxFxs = address(0x8c279F6Bfa31c47F29e5d05a68796f2A6c216892);
    address public constant extraRewards = address(0x858847c21B075e45727fcB0B544BD843CD750361);

    //get apr with given rates and prices
    function apr(uint256 _rate, uint256 _priceOfReward, uint256 _priceOfDeposit) external pure returns(uint256 _apr){
        return _rate * 365 days * _priceOfReward / _priceOfDeposit; 
    }

    //%return = rate * timeFrame * price of reward / price of LP / 1e18
    function stakedCvxFxsRewardRates() external view returns (address[] memory tokens, uint256[] memory rates) {
        //only one token for now but keep array format when/if others added
        tokens = new address[](1);
        rates = new uint256[](1);
        tokens[0] = fxs;

        //reward rates for vefxs rewards
        uint256 yieldRate = IFraxtalVeFxsRewardDistro(vefxsRewards).yieldRate();
        uint256 convexVefxs = IFraxtalVeFxsRewardDistro(vefxsRewards).userVeFXSCheckpointed(convexProxy);
        uint256 totalVefxs = IFraxtalVeFxsRewardDistro(vefxsRewards).totalVeFXSParticipating();
        uint256 supplyStkCvxfxs = IERC20(stkCvxFxs).totalSupply();

        if(supplyStkCvxfxs == 0){
            return(tokens,rates);
        }

        yieldRate = yieldRate * convexVefxs / totalVefxs;

        uint256 ratePerStakedCvxfxs = yieldRate * 1e18 / supplyStkCvxfxs;
        rates[0] = ratePerStakedCvxfxs;

        //reward rates from other fxs sources
        uint256 extraSupply = IRewardStaking(extraRewards).totalSupply();
        uint256 weightForCvxfxs = IRewardStaking(extraRewards).balanceOf(convexProxy);
        if(block.timestamp <= IRewardStaking(extraRewards).periodFinish()){
            uint256 extrarate = IRewardStaking(extraRewards).rewardRate();
            extrarate = extrarate * weightForCvxfxs / extraSupply;
            rates[0] +=  extrarate * 1e18 / supplyStkCvxfxs;
        }
    }
}
