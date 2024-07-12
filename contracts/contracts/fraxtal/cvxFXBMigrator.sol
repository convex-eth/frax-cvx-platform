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


//sample migration used for testing
contract cvxFXBMigrator{
    using SafeERC20 for IERC20;

    address public immutable cvxfxb;
    address public immutable oldfxb;
    address public immutable fxb;
    address public immutable fraxlend;

    //events
    event Migrated(address indexed _old, address _new, address _newFraxlend);
    

    constructor(address _cvxfxb, address _oldfxb, address _newfxb, address _fraxlend){
        cvxfxb = _cvxfxb;
        oldfxb = _oldfxb;
        fxb = _newfxb;
        fraxlend = _fraxlend;
    }

    function migrate() external{
        //INSERT EXCHANGE LOGIC ETC

        //send new fxb back
        IERC20(fxb).safeTransfer(cvxfxb, IERC20(fxb).balanceOf(address(this)));
    }

}