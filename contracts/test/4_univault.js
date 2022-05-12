const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");
const INonfungiblePositionManager = artifacts.require("INonfungiblePositionManager");
const TestPool_UniV3 = artifacts.require("TestPool_UniV3");
const StakingProxyUniV3 = artifacts.require("StakingProxyUniV3");

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

    let starttime = await time.latest();
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

    //get usdc
    let usdc = await IERC20.at("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    let usdclp = "0x0a59649758aa4d66e25f08dd01271e891fe52199";
    await unlockAccount(usdclp);
    await usdc.transfer(userA,100000000000,{from:usdclp,gasPrice:0});
    var usdcBalance = await usdc.balanceOf(userA);
    console.log("usdc: " +usdcBalance);

    //frax/usdc
    let positionManager = await INonfungiblePositionManager.at("0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
    await frax.approve(positionManager.address,web3.utils.toWei("100000000.0", "ether"));
    await usdc.approve(positionManager.address,web3.utils.toWei("100000000.0", "ether"));
    console.log("approved to univ3");

    //mint base nft
    await positionManager.mint([frax.address,usdc.address,500,"-276380","-276270",fraxBalance, usdcBalance, 0, 0, userA, starttime+3600]);
    console.log("minted")

    let balanceOfNfts = await positionManager.balanceOf(userA);
    console.log("nft balanceOf: " +balanceOfNfts);

    let tokenId = await positionManager.tokenOfOwnerByIndex(userA, 0);
    console.log("token id: " +tokenId);

    let sampleposition = await positionManager.positions(tokenId);
    console.log("sampleposition: " +JSON.stringify(sampleposition));

    let stakingAddress = await TestPool_UniV3.new(tokenId);



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
    await booster.setPendingOwner(multisig);
    await booster.acceptPendingOwner({from:multisig,gasPrice:0});
    await booster.setRewardManager(multisig,{from:multisig,gasPrice:0});
    await booster.setPoolManager(multisig,{from:multisig,gasPrice:0});
    await booster.setPoolRewardImplementation(rewardMaster.address,{from:multisig,gasPrice:0});
    await booster.setPoolFeeDeposit(booster.address,{from:multisig,gasPrice:0});
    console.log("booster init");



    //create new pool and vault
    // let stakingAddress = await IFraxFarmERC20.at("0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6");
    // var stakingOwner = await stakingAddress.owner();
    // await unlockAccount(stakingOwner);
    // await stakingAddress.toggleValidVeFXSProxy(contractList.system.voteProxy,{from:stakingOwner,gasPrice:0});
    // let stakingToken = await IERC20.at("0xc14900dFB1Aa54e7674e1eCf9ce02b3b35157ba5");
    let impl = await StakingProxyUniV3.new();
    var tx = await booster.addPool(impl.address, stakingAddress.address, positionManager.address, {from:multisig,gasPrice:0});
    console.log("pool added, gas: " +tx.receipt.gasUsed);

    var poolinfo = await poolReg.poolInfo(0);
    console.log(poolinfo);
    var poolRewards = await MultiRewards.at(poolinfo.rewardsAddress);
    console.log("rewards at " +poolRewards.address);
    // await poolRewards.setbooster(booster.address);

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
    let vault = await StakingProxyUniV3.at(vaultAddress)
    console.log("vault created " +vault.address +", gas: " +tx.receipt.gasUsed);


    //approve
    // await positionManager.approve(vault.address,tokenId);
    await positionManager.setApprovalForAll(vault.address,true);
    console.log("approved");
    await positionManager.isApprovedForAll(userA, vault.address).then(a=>console.log("approved for all? " +a));

    //stake
    let lockDuration = day * 30;
    await vault.stakeLocked(tokenId,lockDuration);
    console.log("staked");

    var stakeInfo = await stakingAddress.lockedNFTsOf(vault.address);
    console.log("stake info: " +stakeInfo);
    console.log("stake info: " +JSON.stringify(stakeInfo));

    //TODO: lock additional


    //withdraw
    await advanceTime(lockDuration + day);
    await positionManager.balanceOf(userA).then(a=>console.log("nft count userA: " +a));
    await vault.withdrawLocked(tokenId);
    console.log("-> withdrawn");
    await positionManager.balanceOf(userA).then(a=>console.log("nft count userA: " +a));

    // await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));
    // await stakingAddress.getAllRewardTokens().then(a=>console.log("getAllRewardTokens: " +a))
    // await stakingAddress.lockedLiquidityOf(vault.address).then(a=>console.log("lockedLiquidityOf: " +a))
    // await stakingAddress.combinedWeightOf(vault.address).then(a=>console.log("combinedWeightOf: " +a))
    // await stakingAddress.veFXSMultiplier(vault.address).then(a=>console.log("veFXSMultiplier: " +a))

    // // await vault.weightedRewardRates().then(a=>console.log("weightedRewardRates: " +a))
    // // await vault.userBoostedRewardRates().then(a=>console.log("userBoostedRewardRates: " +a))

    // await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));
    // await poolUtil.userBoostedRewardRates(stakingAddress.address, vault.address).then(a=>console.log("pool util -> userBoostedRewardRates: " +a));
    // await poolUtil.veFXSMultiplier(stakingAddress.address).then(a=>console.log("pool util -> veFXSMultiplier: " +a));

  });
});


