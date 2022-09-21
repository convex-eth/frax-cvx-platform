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

contract("Gauge Weights", async accounts => {
  it("should determine gauge weights", async () => {
    
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


    var pooldata = [];
    var poolList = contractList.pools;

    var votedFarms = [];
    console.log("----- before vote -----");
    var totalWeight = 0;
    for(var poolId in poolList){
        var pool = poolList[poolId];

        let checkvoted = votedFarms.find(a => a == pool.stakingAddress);
        if(checkvoted != undefined) continue;

        var poolVoteInfo = await controller.vote_user_slopes(contractList.system.voteProxy,pool.stakingAddress);
        console.log(pool.name + " weight: " +poolVoteInfo[1]);
        totalWeight += Number(poolVoteInfo[1]);
        votedFarms.push(pool.stakingAddress);
    }
    console.log("----------");
    console.log("total weight: " +totalWeight +"\n\n");


    gaugeList = [
      '0x0a08673E3d7c454E1c6b27acD059C50Df6727FC9',
      '0x963f487796d54d2f27bA6F3Fbe91154cA103b199',
      '0x560c7668459221e33ED515D1D17c09ECda1996f5',
      '0xF0A9b6F6593b4Bf96E1Ab13921A8a3FbFd9d4F16',
      '0xF0Ffe16810B7f412c52C1610e3BC9819A7Dcb366',
      '0xaCf54f101B86f9e55d35C0674Ebd8C854E5f80e4',
      '0x711d650Cd10dF656C2c28D375649689f137005fA',
      '0xF7242A1cE383174802818febB36B6eebb56d5BFb',
      '0xb324b2BD8a3Dc55b04111E84d5cce0c3771F8889',
      '0xa810D1268cEF398EC26095c27094596374262826',
      '0x40b42E4ab3c044e67CBFb0bD99C9E975dcB83668',
      '0xE7211E87D60177575846936F2123b5FA6f0ce8Ab',
      '0xd1f21322bBDd3586dC1151ADCcaA2684641c2b31',
      '0xeC670c5e0A8A8d5ae5639158565D840DE44CA03f',
      '0x57c9F019B25AaAF822926f4Cacf0a860f61eDd8D',
      '0x2F9504988675c91787E188Ed928D6E042d9052e9',
      '0xA0657642224Fc53dAB4a3d2069430afe157BEc5D',
      '0xdE5684F85a78F6CcCFFB4b9301ad0944eb5CE3eE'
    ];

    weightList = [
    1452, 4185,  45,  45,  107,
     112,  147, 138, 272, 1058,
      27,  218,  27, 265,  923,
     923,   29,  27
  ]

    var calldata = booster.contract.methods.voteGaugeWeight(controller.address, gaugeList,weightList);
    console.log("calldata:");
    console.log(calldata.encodeABI());


    var tx = await booster.voteGaugeWeight(controller.address, gaugeList,weightList,{from:deployer});//,gasPrice:0});

    console.log("\n----- final weight -----");
    votedFarms = [];
    var totalWeight = 0;
    for(var poolId in poolList){
        var pool = poolList[poolId];
        let checkvoted = votedFarms.find(a => a == pool.stakingAddress);
        if(checkvoted != undefined) continue;
        var poolVoteInfo = await controller.vote_user_slopes(contractList.system.voteProxy,pool.stakingAddress);
        console.log(pool.name + " weight: " +poolVoteInfo[1]);
        totalWeight += Number(poolVoteInfo[1]);
        votedFarms.push(pool.stakingAddress);
    }
    console.log("----------");
    console.log("total weight: " +totalWeight +"\n\n");


  });
});


