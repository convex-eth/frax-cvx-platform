// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import "./interfaces/IProxyVault.sol";
import "./interfaces/IFeeRegistry.sol";
import "./interfaces/IFraxFarmBase.sol";
import "./interfaces/IRewards.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "./interfaces/IProxyVault.sol";
import "./interfaces/ILockReceiver.sol";
// import "./interfaces/IPoolRegistry.sol";


contract StakingProxyBase is IProxyVault{
    using SafeERC20 for IERC20;

    address public constant fxs = address(0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0);
    address public constant vefxsProxy = address(0x59CFCD384746ec3035299D90782Be065e466800B);
    address public constant feeRegistry = address(0xC9aCB83ADa68413a6Aa57007BC720EE2E2b3C46D); //fee registry

    address public owner; //owner of the vault
    address public stakingAddress; //farming contract
    address public stakingToken; //farming token
    address public rewards; //extra rewards on convex
    address public usingProxy; //address of proxy being used

    uint256 public constant FEE_DENOMINATOR = 10000;

    //the poolId for calling vaultMap in the registry to verify a receiver is a legitimate convex vault (for lock transfers)
    /// TODO update the pre transfer vault check mechanism
    address public constant poolRegistry = address(0x7413bFC877B5573E29f964d572f421554d8EDF86);
    // address public poolRegistry;
    // uint256 public poolId;

    constructor() {
    }

    function vaultType() external virtual pure returns(VaultType){
        return VaultType.Erc20Basic;
    }

    function vaultVersion() external virtual pure returns(uint256){
        return 1;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "!auth");
        _;
    }

    modifier onlyAdmin() {
        require(vefxsProxy == msg.sender, "!auth_admin");
        _;
    }

    //initialize vault
    function initialize(address _owner, address _stakingAddress, address _stakingToken, address _rewardsAddress) external virtual{

    }

    /// @notice before transfer hook called to sender of lock - checks that receiver is a known convex vault & checkpoints extra rewards
    /// @param sender The address sending locked stakes to receiver
    /// @param receiver The address receiving locked stake from sender
    /// @param lockId The lockId of the stake sender is transferring from
    /// @param data Curently just bytes(0), emulates onERC721Received standard
    /// @return bytes4 This function selector as bytes4
    function beforeLockTransfer(address sender, address receiver, uint256 lockId, bytes memory data) external returns (bytes4) {
        //sender must be this vault
        require(sender == address(this), "!Sender");
        //can only be called from the staker/frax farm
        require(msg.sender == stakingAddress, "caller!staker");
        // TODO modify this to work as desired
        //check that the receiver is a legitimate convex vault
        // require(receiver == IPoolRegistry(poolRegistry).vaultMap(poolId, IProxyVault(receiver).owner()), "receiver!vault");
        
        /// Checkpoint rewards in both vaults
        _checkpointRewards();
        IProxyVault(receiver).checkpointVaultRewards();

        // if the owner of the vault is a contract try calling onLockReceived on it, return the selector either way
        if (owner.code.length > 0) {
            return ILockReceiver(owner).beforeLockTransfer(sender, receiver, lockId, data);
        } else {
            return ILockReceiver.beforeLockTransfer.selector;
        }
    }

    /// @notice onLockReceived callback - calls to the receiving vault from the farm
    /// @param sender The address sending locked stakes to receiver
    /// @param receiver The address receiving locked stake from sender
    /// @param lockId The lockId of the receiver's new position
    /// @param data Curently just bytes(0), emulates onERC721Received standard
    /// @return bytes4 This function selector as bytes4
    function onLockReceived(address sender, address receiver, uint256 lockId, bytes memory data) external returns (bytes4) {
        //sender must be this vault
        require(receiver == address(this), "!Receiver");
        //can only be called from the staker/frax farm
        require(msg.sender == stakingAddress, "caller!staker");

        // if the owner of the vault is a contract try calling onLockReceived on it, 
        if (owner.code.length > 0) {
            return ILockReceiver(owner).onLockReceived(sender, receiver, lockId, data);
        } else {
            return ILockReceiver.onLockReceived.selector;
        }
    }

    function changeRewards(address _rewardsAddress) external onlyAdmin{
        
        //remove from old rewards and claim
        if(IRewards(rewards).active()){
            uint256 bal = IRewards(rewards).balanceOf(address(this));
            if(bal > 0){
                IRewards(rewards).withdraw(owner, bal);
            }
            IRewards(rewards).getReward(owner);
        }

        //set to new rewards
        rewards = _rewardsAddress;

        //update balance
        _checkpointRewards();
    }

    //checkpoint weight on farm by calling getReward as its the lowest cost thing to do.
    function checkpointRewards() external onlyAdmin{
        //checkpoint the frax farm
        _checkpointFarm();
    }

    /// Added so vaults can checkpoint rewards in beforeLockTransfer
    function checkpointVaultRewards() public {
        //checkpoint the rewards contract
        _checkpointRewards();
    }

    function _checkpointFarm() internal{
        //claim rewards to local vault as a means to checkpoint
        IFraxFarmBase(stakingAddress).getReward(address(this));
    }

    function setVeFXSProxy(address _proxy) external virtual onlyAdmin{
        //set the vefxs proxy
        _setVeFXSProxy(_proxy);
    }

    function _setVeFXSProxy(address _proxyAddress) internal{
        //set proxy address on staking contract
        IFraxFarmBase(stakingAddress).stakerSetVeFXSProxy(_proxyAddress);
        usingProxy = _proxyAddress;
    }

    function getReward() external virtual{}
    function getReward(bool _claim) external virtual{}
    function getReward(bool _claim, address[] calldata _rewardTokenList) external virtual{}
    function earned() external view virtual returns (address[] memory token_addresses, uint256[] memory total_earned){}
    function setAllowance(address spender, uint256 _lockId, uint256 amount) external virtual{}
    function increaseAllowance(address spender, uint256 _lockId, uint256 amount) external virtual{}
    function removeAllowance(address spender, uint256 _lockId) external virtual{}
    function setApprovalForAll(address spender, bool approved) external virtual{}

    //checkpoint and add/remove weight to convex rewards contract
    function _checkpointRewards() internal{
        //if rewards are active, checkpoint
        if(IRewards(rewards).active()){
            //using liquidity shares from staking contract will handle rebasing tokens correctly
            uint256 userLiq = IFraxFarmBase(stakingAddress).lockedLiquidityOf(address(this));
            //get current balance of reward contract
            uint256 bal = IRewards(rewards).balanceOf(address(this));
            if(userLiq >= bal){
                //add the difference to reward contract
                IRewards(rewards).deposit(owner, userLiq - bal);
            }else{
                //remove the difference from the reward contract
                IRewards(rewards).withdraw(owner, bal - userLiq);
            }
        }
    }

    //apply fees to fxs and send remaining to owner
    function _processFxs() internal{

        //get fee rate from fee registry
        uint256 totalFees = IFeeRegistry(feeRegistry).totalFees();

        //send fxs fees to fee deposit
        uint256 fxsBalance = IERC20(fxs).balanceOf(address(this));
        uint256 sendAmount = fxsBalance * totalFees / FEE_DENOMINATOR;
        if(sendAmount > 0){
            IERC20(fxs).transfer(IFeeRegistry(feeRegistry).getFeeDepositor(usingProxy), sendAmount);
        }

        //transfer remaining fxs to owner
        sendAmount = IERC20(fxs).balanceOf(address(this));
        if(sendAmount > 0){
            IERC20(fxs).transfer(owner, sendAmount);
        }
    }

    //get extra rewards
    function _processExtraRewards() internal{
        if(IRewards(rewards).active()){
            //check if there is a balance because the reward contract could have be activated later
            //dont use _checkpointRewards since difference of 0 will still call deposit() and cost gas
            uint256 bal = IRewards(rewards).balanceOf(address(this));
            uint256 userLiq = IFraxFarmBase(stakingAddress).lockedLiquidityOf(address(this));
            if(bal == 0 && userLiq > 0){
                //bal == 0 and liq > 0 can only happen if rewards were turned on after staking
                IRewards(rewards).deposit(owner,userLiq);
            }
            IRewards(rewards).getReward(owner);
        }
    }

    //transfer other reward tokens besides fxs(which needs to have fees applied)
    function _transferTokens(address[] memory _tokens) internal{
        //transfer all tokens
        for(uint256 i = 0; i < _tokens.length; i++){
            if(_tokens[i] != fxs){
                uint256 bal = IERC20(_tokens[i]).balanceOf(address(this));
                if(bal > 0){
                    IERC20(_tokens[i]).safeTransfer(owner, bal);
                }
            }
        }
    }

}
