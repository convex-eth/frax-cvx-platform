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

const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");

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

    //get frax
    let fraxlp = "0xd632f22692FaC7611d2AA1C0D552930D43CAEd3B";
    await unlockAccount(fraxlp);
    await frax.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:fraxlp,gasPrice:0});
    var fraxBalance = await frax.balanceOf(userA);
    console.log("frax: " +fraxBalance);


    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    let operator = await Booster.at(contractList.system.booster);
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    await operator.shutdownSystem({from:multisig, gasPrice:0});
    console.log("placeholder shutdown");

    //deply new booster
    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.new();
    let booster = await Booster.new(voteproxy.address, poolReg.address, feeReg.address);
    let rewardMaster = await MultiRewards.new(booster.address, poolReg.address);
    console.log("new booster deployed: " +booster.address);

    let poolUtil = await PoolUtilities.new();
    console.log("pool utilities: " +poolUtil.address);

    await voteproxy.setOperator(booster.address,{from:multisig, gasPrice:0});
    console.log("voteproxy operator set to new booster");

    await booster.claimOperatorRoles();
    await booster.setOwner(multisig);
    await booster.setRewardManager(multisig,{from:multisig,gasPrice:0});
    await booster.setPoolManager(multisig,{from:multisig,gasPrice:0});
    await booster.setPoolRewardImplementation(rewardMaster.address,{from:multisig,gasPrice:0});
    await booster.setPoolFeeDeposit(booster.address,{from:multisig,gasPrice:0});
    console.log("booster init");


    // let stakingToken = await IERC20.at("0xA74A725F143C9b4cc139929b6Df67405f8eC9AAe");
    let stakingToken = await IERC20.at("0x7287488F8Df7dddc5f373142D4827aAF92AAC845");
    let stakingwrapper = await IConvexWrapper.at(stakingToken.address);

    //create new pool and vault
    // let stakingAddress = await IFraxFarmERC20.at("0x183a756F416C723000E7BD3fB0e66cBA3E48c52D");
    let stakingAddress = await TestPool_Erc20.new(stakingToken.address);
    var stakingOwner = await stakingAddress.owner();
    await unlockAccount(stakingOwner);
    await stakingAddress.toggleValidVeFXSProxy(contractList.system.voteProxy,{from:stakingOwner,gasPrice:0});
    

    //set wrapper vault
    await stakingwrapper.setVault(stakingAddress.address,{from:deployer});


    let impl = await StakingProxyConvex.new();
    var tx = await booster.addPool(impl.address, stakingAddress.address, stakingToken.address,{from:multisig,gasPrice:0});
    console.log("pool added, gas: " +tx.receipt.gasUsed);

    var poolinfo = await poolReg.poolInfo(0);
    console.log(poolinfo);
    var poolRewards = await MultiRewards.at(poolinfo.rewardsAddress);
    console.log("rewards at " +poolRewards.address);

    //compare gas when rewards contract is active by toggling this
    // await poolRewards.setActive({from:multisig,gasPrice:0});
    //Uncomment to add rewards
    // await poolRewards.addReward(contractList.system.cvx, deployer, {from:multisig,gasPrice:0});
    // let cvx = await IERC20.at(contractList.system.cvx);
    // await cvx.approve(poolRewards.address,web3.utils.toWei("100000.0", "ether"),{from:deployer});
    // await poolRewards.notifyRewardAmount(contractList.system.cvx,web3.utils.toWei("1000.0", "ether"),{from:deployer});
    // let rdata = await poolRewards.rewardData(contractList.system.cvx);
    // console.log("reward data: \n" +JSON.stringify(rdata));

    var tx = await booster.createVault(0);
    let vaultAddress = await poolReg.vaultMap(0,userA);
    let vault = await StakingProxyConvex.at(vaultAddress)
    console.log("vault created " +vault.address +", gas: " +tx.receipt.gasUsed);


    //get tokens
    let fpilp = await IERC20.at("0x4704aB1fb693ce163F7c9D3A31b3FF4eaF797714");
    let fpiHolder = "0xdb7cbbb1d5d5124f86e92001c9dfdc068c05801d";
    await unlockAccount(fpiHolder);
    await fpilp.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:fpiHolder,gasPrice:0});

    var tokenBalance = await stakingToken.balanceOf(userA);
    console.log("tokenBalance: " +tokenBalance);

    var lockDuration = day*30;
    // var lockDuration = day*364*3;
    //stake
    await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    await fpilp.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    var tx = await vault.stakeLockedCurveLp(web3.utils.toWei("100000.0","ether"), lockDuration);
    console.log("staked, gas: " +tx.receipt.gasUsed);

    

    var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    console.log("stake info: " +stakeInfo);
    console.log("kek id: " +stakeInfo[0][0]);
    console.log("stake info: " +JSON.stringify(stakeInfo));
    // await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));
    // await stakingAddress.getAllRewardTokens().then(a=>console.log("getAllRewardTokens: " +a))
    // await stakingAddress.lockedLiquidityOf(vault.address).then(a=>console.log("lockedLiquidityOf: " +a))
    // await stakingAddress.combinedWeightOf(vault.address).then(a=>console.log("combinedWeightOf: " +a))
    // await stakingAddress.veFXSMultiplier(vault.address).then(a=>console.log("veFXSMultiplier: " +a))

    // await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));
    // await poolUtil.userBoostedRewardRates(stakingAddress.address, vault.address).then(a=>console.log("pool util -> userBoostedRewardRates: " +a));
    // await poolUtil.veFXSMultiplier(stakingAddress.address).then(a=>console.log("pool util -> veFXSMultiplier: " +a));

    //stake again with additional
    // await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    // var tx = await vault.lockAdditional(stakeInfo[0][0],web3.utils.toWei("100000.0","ether"));
    // console.log("staked additional, gas: " +tx.receipt.gasUsed);
    // var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    // console.log("stake info: " +stakeInfo);
    // await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));

    await advanceTime(day);

    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await crv.balanceOf(userA).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    await fxs.balanceOf(booster.address).then(a=>console.log("booster fxs: " +a));
    await stakingAddress.earned(vault.address).then(a=>console.log("farm earned: " +a));
    await stakingwrapper.earned(vault.address).then(a=>console.log("stakingwrapper earned: " +a));
    await stakingwrapper.earned(stakingAddress.address).then(a=>console.log("stakingwrapper stakingAddress earned: " +a));
    await vault.earned().then(a=>console.log("vault earned: " +JSON.stringify(a) ));
    await vault.getReward();
    console.log("-> vault get reward");
    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await crv.balanceOf(userA).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    await fxs.balanceOf(booster.address).then(a=>console.log("booster fxs: " +a));

    console.log("\n\n===================\n\n")

    await advanceTime(day);
    await crv.balanceOf(userA).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    await stakingwrapper.getReward(vault.address, userA).catch(a=>console.log("--> error forwarding: " +a));
    await stakingwrapper.getReward(vault.address);
    console.log("wrapper.getReward(vault)");
    await crv.balanceOf(userA).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    // await vault.getReward(false,[crv.address, cvx.address]);
    await vault.methods['getReward(bool,address[])'](false,[crv.address, cvx.address]);
    console.log("vault.getReward(false,[crv.address, cvx.address])");
    await crv.balanceOf(userA).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(userA).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));


    // //withdraw
    await advanceTime(lockDuration + day);
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));
    await fpilp.balanceOf(userA).then(a=>console.log("fpilp token userA: " +a));
    // await vault.withdrawLocked(stakeInfo[0][0]);
    await vault.withdrawLockedAndUnwrap(stakeInfo[0][0]);
    console.log("-> withdrawn");
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));
    await fpilp.balanceOf(userA).then(a=>console.log("fpilp token userA: " +a));
  });
});


