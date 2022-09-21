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

   

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    var booster = await Booster.at(contractList.system.booster);
    var curvebooster = await ICurveConvex.at("0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.at(contractList.system.poolRegistry);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);
    let feeDepo = await FeeDeposit.at(contractList.system.feeDeposit);
    let rewardMaster = await MultiRewards.at(contractList.system.rewardImplementation);


    // let stakingToken = await IERC20.at("0xA74A725F143C9b4cc139929b6Df67405f8eC9AAe");
    // let stakingToken = await IERC20.at("0xcB0bC7C879bb3E9CFEB9d8EFef653F33B3d242e9");
    let stakingToken = await IERC20.at("0x56695c26b3Cdb528815cd22fF7B47510ab821EFd");
    //frax farm
    // let stakingAddress = await IFraxFarmERC20.at("0x35678017e1D252dA1CdD6745b147E3e75d1f9C27");
    let stakingAddress = await IFraxFarmERC20.at("0x9d46C0584C5C89e14fb1143e2414712feF36f00F");
    //get tokens
    // let lptoken = await IERC20.at("0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
    // let lpHolder = "0x35678017e1D252dA1CdD6745b147E3e75d1f9C27";
    let lpHolder = "0x6a7efa964cf6d9ab3bc3c47ebddb853a8853c502";
    await unlockAccount(lpHolder);
    await stakingToken.transfer(userA,web3.utils.toWei("100000.0", "ether"),{from:lpHolder,gasPrice:0});



    //add to gauge
    // console.log("add gauge and vote");
    // let fraxadmin = "0xb1748c79709f4ba2dd82834b8c82d4a505003f27";
    // await unlockAccount(fraxadmin);
    // await controller.add_gauge(stakingAddress.address,0,0,{from:fraxadmin,gasPrice:0});
    // var fxsrewardsdistro = await IFraxRewardDistributor.at(contractList.frax.rewardDistributor);
    // await fxsrewardsdistro.setGaugeState(stakingAddress.address, false, true, {from:fraxadmin, gasPrice:0});
    // console.log("added to reward whitelist");
    // var fpigauge = "0x0a08673E3d7c454E1c6b27acD059C50Df6727FC9"
    // await booster.voteGaugeWeight(controller.address, [fpigauge], [0], {from:deployer, gasPrice:0});
    // await booster.voteGaugeWeight(controller.address, [stakingAddress.address], [5000], {from:deployer, gasPrice:0});
    // console.log("voted");
    // await advanceTime(day*7);

    // set valid proxy
    // var stakingOwner = await stakingAddress.owner();
    // await unlockAccount(stakingOwner);
    // await stakingAddress.toggleValidVeFXSProxy(contractList.system.voteProxy,{from:stakingOwner,gasPrice:0});

    var poolcount = await poolReg.poolLength();
    // var poolcount = 5;
    console.log("pool count: " +poolcount);

    let impl = await StakingProxyERC20.new();
    
    var tx = await booster.addPool(impl.address, stakingAddress.address, stakingToken.address,{from:deployer,gasPrice:0});
    console.log("pool added, gas: " +tx.receipt.gasUsed);
    await poolReg.poolLength().then(a=>console.log("new pool count: " +a));

    var poolinfo = await poolReg.poolInfo(poolcount);
    console.log(poolinfo);
    
    var tx = await booster.createVault(poolcount,{from:userA});
    let vaultAddress = await poolReg.vaultMap(poolcount,userA);
    let vault = await StakingProxyERC20.at(vaultAddress)
    console.log("vault created " +vault.address +", gas: " +tx.receipt.gasUsed);

        

    var tokenBalance = await stakingToken.balanceOf(userA);
    console.log("stakingToken Balance: " +tokenBalance);

    var lockDuration = day*30;
    // var lockDuration = day*364*3;
    //stake
    await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    var tx = await vault.stakeLocked(web3.utils.toWei("10000.0","ether"), lockDuration);
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
    // await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    var tx = await vault.lockAdditional(stakeInfo[0][0],web3.utils.toWei("10000.0","ether"));
    console.log("staked additional, gas: " +tx.receipt.gasUsed);
    var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    console.log("stake info: " +stakeInfo);
    await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));



    // //withdraw
    await advanceTime(lockDuration + day);
    await vault.earned().then(a=>console.log("vault earned: " +JSON.stringify(a) ));

    console.log("claim rewards...");
    await vault.getReward();
    console.log("-> vault get reward");

    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));
    await stakingToken.balanceOf(vault.address).then(a=>console.log("staking token vault: " +a));
    await stakingToken.balanceOf(stakingAddress.address).then(a=>console.log("staking token farm: " +a));
    await vault.withdrawLocked(stakeInfo[0][0]);
    // await vault.withdrawLockedAndUnwrap(stakeInfo[0][0]);
    console.log("-> withdrawn");
    await stakingToken.balanceOf(userA).then(a=>console.log("staking token userA: " +a));

    await vault.earned().then(a=>console.log("vault earned: " +JSON.stringify(a) ));

    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await fxs.balanceOf(vault.address).then(a=>console.log("vault fxs: " +a));
    await fxs.balanceOf(feeDepo.address).then(a=>console.log("feeDepo fxs: " +a));
    await vault.getReward();
    console.log("-> vault get reward");
    await fxs.balanceOf(userA).then(a=>console.log("user A fxs: " +a));
    await fxs.balanceOf(vault.address).then(a=>console.log("vault fxs: " +a));
    await fxs.balanceOf(feeDepo.address).then(a=>console.log("feeDepo fxs: " +a));
  });
});


