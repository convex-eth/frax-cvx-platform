const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const BoosterPlaceholder = artifacts.require("BoosterPlaceholder");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");

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

    await unlockAccount(multisig);
    await unlockAccount(deployer);

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
    let operator = await BoosterPlaceholder.at(contractList.system.booster);
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    await operator.shutdownSystem({from:multisig, gasPrice:0});
    console.log("placeholder shutdown");

    //deply new booster
    let feeReg = await FeeRegistry.new();
    console.log("fee Registry: " +feeReg.address);
    let poolReg = await PoolRegistry.new();
    console.log("pool Registry: " +poolReg.address);
    let booster = await Booster.new(voteproxy.address, poolReg.address, feeReg.address);
    let rewardMaster = await MultiRewards.new(booster.address, poolReg.address);
    console.log("new booster deployed: " +booster.address);

    await voteproxy.setOperator(booster.address,{from:multisig, gasPrice:0});
    console.log("voteproxy operator set to new booster");

    await booster.claimOperatorRoles();
    await booster.setOwner(multisig);
    await booster.setRewardManager(multisig,{from:multisig,gasPrice:0});
    await booster.setPoolRewardImplementation(rewardMaster.address,{from:multisig,gasPrice:0});
    await booster.setPoolFeeDeposit(booster.address,{from:multisig,gasPrice:0});
    console.log("booster init");

    //create new pool and vault
    let stakingAddress = await IFraxFarmERC20.at("0x698137C473bc1F0Ea9b85adE45Caf64ef2DF48d6");
    var stakingOwner = await stakingAddress.owner();
    await unlockAccount(stakingOwner);
    await stakingAddress.toggleValidVeFXSProxy(contractList.system.voteProxy,{from:stakingOwner,gasPrice:0});
    let stakingToken = await IERC20.at("0xc14900dFB1Aa54e7674e1eCf9ce02b3b35157ba5");
    let impl = await StakingProxyERC20.new();
    var tx = await booster.addPool(impl.address, stakingAddress.address, stakingToken.address,{from:multisig,gasPrice:0});
    console.log("pool added, gas: " +tx.receipt.gasUsed);

    var poolinfo = await poolReg.poolInfo(0);
    console.log(poolinfo);
    var poolRewards = await MultiRewards.at(poolinfo.rewardsAddress);
    console.log("rewards at " +poolRewards.address);
    // await poolRewards.setbooster(booster.address);

    //Uncomment to add rewards
    // await poolRewards.setActive({from:multisig,gasPrice:0});
    // await poolRewards.addReward(contractList.system.cvx, deployer, {from:multisig,gasPrice:0});
    // let cvx = await IERC20.at(contractList.system.cvx);
    // await cvx.approve(poolRewards.address,web3.utils.toWei("100000.0", "ether"),{from:deployer});
    // await poolRewards.notifyRewardAmount(contractList.system.cvx,web3.utils.toWei("1000.0", "ether"),{from:deployer});
    // let rdata = await poolRewards.rewardData(contractList.system.cvx);
    // console.log("reward data: \n" +JSON.stringify(rdata));


    //get vesper token
    let tokenholder = "0x698137c473bc1f0ea9b85ade45caf64ef2df48d6";
    await unlockAccount(tokenholder);
    await stakingToken.transfer(userA,web3.utils.toWei("200000.0", "ether"),{from:tokenholder,gasPrice:0});
    var tokenBalance = await stakingToken.balanceOf(userA);
    console.log("tokenBalance: " +tokenBalance);

    //creating user vault
    // var tx = await booster.createVault(0);
    // let vaultAddress = await poolReg.vaultMap(0,userA);
    // let vault = await StakingProxyERC20.at(vaultAddress)
    // console.log("vault created " +vault.address +", gas: " +tx.receipt.gasUsed);

    //stake
    // await stakingToken.approve(vault.address, web3.utils.toWei("100000.0","ether"));
    // var tx = await vault.stakeLocked(web3.utils.toWei("100000.0","ether"), day*30);
    // console.log("staked, gas: " +tx.receipt.gasUsed);

  });
});


