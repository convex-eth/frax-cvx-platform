// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IDeposit.sol";
import "./interfaces/IProxyFactory.sol";
import "./interfaces/IVirtualBalanceRewardPool.sol";
import "./interfaces/IBaseRewards.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';


contract RewardFactory {
    using Address for address;

    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant proxyFactory = address(0x66807B5598A848602734B82E432dD88DBE13fC8f);

    address public operator;
    address public mainImplementation;
    address public virtualImplementation;
    mapping (address => bool) private rewardAccess;
    // mapping(address => uint256[]) public rewardActiveList;

    constructor(address _operator) {
        operator = _operator;
    }

    function setImplementation(address _imp, address _virtualImp) external{
        require(msg.sender == IDeposit(operator).owner(),"!auth");

        mainImplementation = _imp;
        virtualImplementation = _virtualImp;
    }

    //Get active count function
    // function activeRewardCount(address _reward) external view returns(uint256){
    //     return rewardActiveList[_reward].length;
    // }

    // function addActiveReward(address _reward, uint256 _pid) external returns(bool){
    //     require(rewardAccess[msg.sender] == true,"!auth");
    //     if(_reward == address(0)){
    //         return true;
    //     }

    //     uint256[] storage activeList = rewardActiveList[_reward];
    //     uint256 pid = _pid+1; //offset by 1 so that we can use 0 as empty

    //     uint256 length = activeList.length;
    //     for(uint256 i = 0; i < length; i++){
    //         if(activeList[i] == pid) return true;
    //     }
    //     activeList.push(pid);
    //     return true;
    // }

    // function removeActiveReward(address _reward, uint256 _pid) external returns(bool){
    //     require(rewardAccess[msg.sender] == true,"!auth");
    //     if(_reward == address(0)){
    //         return true;
    //     }

    //     uint256[] storage activeList = rewardActiveList[_reward];
    //     uint256 pid = _pid+1; //offset by 1 so that we can use 0 as empty

    //     uint256 length = activeList.length;
    //     for(uint256 i = 0; i < length; i++){
    //         if(activeList[i] == pid){
    //             if (i != length-1) {
    //                 activeList[i] = activeList[length-1];
    //             }
    //             activeList.pop();
    //             break;
    //         }
    //     }
    //     return true;
    // }

    //stash contracts need access to create new Virtual balance pools for extra gauge incentives(ex. snx)
    function setAccess(address _stash, bool _status) external{
        require(msg.sender == operator, "!auth");
        rewardAccess[_stash] = _status;
    }

    //Create a Managed Reward Pool to handle distribution of all main tokens mined in a pool
    function CreateMainRewards(uint256 _pid, address _depositToken) external returns (address) {
        require(msg.sender == operator, "!auth");

        //operator = booster(deposit) contract so that new fxs can be added and distributed
        //reward manager = this factory so that extra incentive tokens(ex. snx) can be linked to the main managed reward pool
        address rewardPool = IProxyFactory(proxyFactory).clone(mainImplementation);
        IBaseRewards(rewardPool).initialize(_pid,_depositToken,fxs,operator, address(this));
        return rewardPool;
    }

    //create a virtual balance reward pool that mimicks the balance of a pool's main reward contract
    //used for extra incentive tokens(ex. snx) as well as vefxs fees
    function CreateTokenRewards(address _token, address _mainRewards, address _operator) external returns (address) {
        require(msg.sender == operator || rewardAccess[msg.sender] == true, "!auth");


        address rewardPool = IProxyFactory(proxyFactory).clone(mainImplementation);

        //create new pool, use main pool for balance lookup
        IVirtualBalanceRewardPool(rewardPool).initialize(_mainRewards,_token,_operator);

        //add the new pool to main pool's list of extra rewards, assuming this factory has "reward manager" role
        IBaseRewards(_mainRewards).addExtraReward(rewardPool);

        //return new pool's address
        return rewardPool;
    }
}
