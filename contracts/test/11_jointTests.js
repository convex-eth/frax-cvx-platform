const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const TestPool_Erc20 = artifacts.require("TestPool_Erc20");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");
const IConvexWrapper = artifacts.require("IConvexWrapper");
const ICvxLocker = artifacts.require("ICvxLocker");
const FeeDeposit = artifacts.require("FeeDeposit");
const JointVaultManager = artifacts.require("JointVaultManager");
const StakingProxyERC20Joint = artifacts.require("StakingProxyERC20Joint");

const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");
const IFraxRewardDistributor = artifacts.require("IFraxRewardDistributor");

const ICurveConvex = artifacts.require("ICurveConvex");


const unlockAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_unlockUnknownAccount",
        params: [address],
        id: new Date().getTime(),
      },
      (err, result) => {
        if (err) {
          return reject(err);
        }
        return resolve(result);
      }
    );
  });
};

contract("Vault Tests", async accounts => {
  it("should successfully run", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let frax = await IERC20.at(contractList.frax.frax);
    let fxs = await IERC20.at(contractList.frax.fxs);
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    let crv = await IERC20.at(contractList.system.crv);
    let cvx = await IERC20.at(contractList.system.cvx);
    let cvxfxs = await IERC20.at(contractList.system.cvxFxs);

    let userA = accounts[0];
    let userB = accounts[1];
    let userC = accounts[2];
    let userD = accounts[3];
    let userZ = "0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F";
    var userNames = {};
    userNames[userA] = "A";
    userNames[userB] = "B";
    userNames[userC] = "C";
    userNames[userD] = "D";
    userNames[userZ] = "Z";

    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;
    await unlockAccount(multisig);
    await unlockAccount(deployer);
    

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    var booster = await Booster.at(contractList.system.booster);
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.at(contractList.system.poolRegistry);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);
    let feeDepo = await FeeDeposit.at(contractList.system.feeDeposit);
    let rewardMaster = await MultiRewards.at(contractList.system.rewardImplementation);

    
    await booster.shutdownSystem({from:deployer});
    booster = await Booster.new(voteproxy.address, poolReg.address, feeReg.address, {from:deployer} );
    console.log("new booster: " +booster.address);


    await voteproxy.setOperator(booster.address, {from:multisig, gasPrice:0});
    console.log("set new operator");

    //claim op
    await booster.claimOperatorRoles({from:deployer});
    console.log("op claimed");

    var poolCount = await poolReg.poolLength();
    console.log("pools: " +poolCount)

    //deploy manager
    var jointmgr = await JointVaultManager.new();
    var jointowner = "0x8c2D06e11ca4414e00CdEa8f28633A2edAf79499";
    var jointownerProxy = "0xC0223fB0562555Bec938de5363D63EDd65102283";
    await unlockAccount(jointowner);

    console.log("joint manager: " +jointmgr.address);

    //deploy pool imp
    var jointvaultImp = await StakingProxyERC20Joint.new(jointmgr.address, 1);
    console.log("vault imp: " +jointvaultImp.address);
    await jointvaultImp.vaultType().then(a=>console.log("vaultType: " +a))
    await jointvaultImp.vaultVersion().then(a=>console.log("vaultVersion: " +a))

    //deploy pool
    var stakingAddress = await IFraxFarmERC20.at("0x10460d02226d6ef7B2419aE150E6377BdbB7Ef16");
    var stakingToken = await IERC20.at("0x6021444f1706f15465bEe85463BCc7d7cC17Fc03");
    await booster.addPool(jointvaultImp.address, stakingAddress.address, stakingToken.address, {from:deployer} );
    console.log("pool added");
    await poolReg.poolLength().then(a=>console.log("pools: " +a))
    await poolReg.poolInfo(poolCount).then(a=>console.log("pool info: " +JSON.stringify(a)));


    await jointmgr.ownerFeeDeposit().then(a=>console.log("ownerFeeDeposit: " +a))
    await jointmgr.jointownerFeeDeposit().then(a=>console.log("jointownerFeeDeposit: " +a))


    await jointmgr.getOwnerFee(10000, voteproxy.address).then(a=>console.log("getOwnerFee (boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))
    await jointmgr.getOwnerFee(10000, jointownerProxy).then(a=>console.log("getOwnerFee (non boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))

    await jointmgr.getJointownerFee(10000, jointownerProxy).then(a=>console.log("getJointownerFee (boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))
    await jointmgr.getJointownerFee(10000, voteproxy.address).then(a=>console.log("getJointownerFee (non boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))


    await jointmgr.setFees(500,500,1100,{from:multisig,gasPrice:0}).catch(a=>console.log("see fees wrong: "+a))
    await jointmgr.setFees(500,500,1000).catch(a=>console.log("see fees not admin: "+a))
    await jointmgr.setFees(500,1000,200,{from:multisig,gasPrice:0});
    console.log("fees set");
    await jointmgr.acceptFees({from:jointowner,gasPrice:0});
    console.log("fees accepted");
    await jointmgr.ownerIncentive().then(a=>console.log("ownerIncentive: " +a))
    await jointmgr.jointownerIncentive().then(a=>console.log("jointownerIncentive: " +a))
    await jointmgr.boosterIncentive().then(a=>console.log("boosterIncentive: " +a))

    await jointmgr.getOwnerFee(10000, voteproxy.address).then(a=>console.log("getOwnerFee (boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))
    await jointmgr.getOwnerFee(10000, jointownerProxy).then(a=>console.log("getOwnerFee (non boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))

    await jointmgr.getJointownerFee(10000, jointownerProxy).then(a=>console.log("getJointownerFee (boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))
    await jointmgr.getJointownerFee(10000, voteproxy.address).then(a=>console.log("getJointownerFee (non boosted): " +JSON.stringify(a) +"\n_feeAmount: " +a._feeAmount))



    //make vault
    await booster.createVault(poolCount).catch(a=>console.log("not auth for vault. " +a));

    await jointmgr.setAllowedAddress(userA, true,{from:jointowner,gasPrice:0});
    console.log("add to allowed list");

    await booster.createVault(poolCount);
    var userVaultAddress = await poolReg.vaultMap(poolCount, userA);
    let vault = await StakingProxyERC20Joint.at(userVaultAddress)
    console.log("created vault at: " +userVaultAddress +" for user: " +userA);
    await vault.stakingAddress().then(a=>console.log("vault stakingAddress: " +a));
    await vault.stakingToken().then(a=>console.log("vault stakingToken: " +a));
    await vault.rewards().then(a=>console.log("vault rewards: " +a));
    await vault.owner().then(a=>console.log("vault owner: " +a));


    let tokenholder = "0x10460d02226d6ef7b2419ae150e6377bdbb7ef16";
    await unlockAccount(tokenholder);
    await stakingToken.transfer(userA,web3.utils.toWei("1000000.0", "ether"),{from:tokenholder,gasPrice:0});
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));

    var lockDuration = day*180;
    console.log("lock for: " +lockDuration);
    await stakingToken.approve(vault.address, web3.utils.toWei("10000000.0","ether"));
    var tx = await vault.stakeLocked(web3.utils.toWei("100000.0","ether"), lockDuration);
    console.log("staked, gas: " +tx.receipt.gasUsed);


    var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    console.log("stake info: " +stakeInfo);
    console.log("kek id: " +stakeInfo[0][0]);
    console.log("stake info: " +JSON.stringify(stakeInfo));
    await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));
    await stakingAddress.getAllRewardTokens().then(a=>console.log("getAllRewardTokens: " +a))
    await stakingAddress.lockedLiquidityOf(vault.address).then(a=>console.log("lockedLiquidityOf: " +a))
    await stakingAddress.combinedWeightOf(vault.address).then(a=>console.log("combinedWeightOf: " +a))
    await stakingAddress.veFXSMultiplier(vault.address).then(a=>console.log("veFXSMultiplier: " +a))

    await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));
    await poolUtil.userBoostedRewardRates(stakingAddress.address, vault.address).then(a=>console.log("pool util -> userBoostedRewardRates: " +a));
    await poolUtil.veFXSMultiplier(stakingAddress.address).then(a=>console.log("pool util -> veFXSMultiplier: " +a));

    //stake again with additional
    await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    var tx = await vault.lockAdditional(stakeInfo[0][0],web3.utils.toWei("100000.0","ether"));
    console.log("staked additional, gas: " +tx.receipt.gasUsed);
    var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    console.log("stake info: " +stakeInfo);
    await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));

    await advanceTime(day);

    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await fxs.balanceOf(booster.address).then(a=>console.log("booster fxs: " +a));
    await stakingAddress.earned(vault.address).then(a=>console.log("earned: " +a));
    await vault.getReward();
    console.log("-> get reward");
    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await fxs.balanceOf(booster.address).then(a=>console.log("booster fxs: " +a));


    //withdraw
    console.log("\n--- test withdraw ---\n");
    await advanceTime(lockDuration + day);
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));
    await vault.withdrawLocked(stakeInfo[0][0]);
    console.log("-> withdrawn");
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));
  });
});


