// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
const FraxtalBooster = artifacts.require("FraxtalBooster");
// const ProxyFactory = artifacts.require("ProxyFactory");
const cvxToken = artifacts.require("cvxToken");
const TreasuryFunds = artifacts.require("TreasuryFunds");
const RewardDistribution = artifacts.require("RewardDistribution");
const FraxtalPoolUtilities = artifacts.require("FraxtalPoolUtilities");

const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");


const unlockAccount = async (address) => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_impersonateAccount",
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

const setNoGas = async () => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "hardhat_setNextBlockBaseFeePerGas",
        params: ["0x0"],
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

const send = payload => {
  if (!payload.jsonrpc) payload.jsonrpc = '2.0';
  if (!payload.id) payload.id = new Date().getTime();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(payload, (error, result) => {
      if (error) return reject(error);

      return resolve(result);
    });
  });
};

/**
 *  Mines a single block in Ganache (evm_mine is non-standard)
 */
const mineBlock = () => send({ method: 'evm_mine' });

/**
 *  Gets the time of the last block.
 */
const currentTime = async () => {
  const { timestamp } = await web3.eth.getBlock('latest');
  return timestamp;
};

/**
 *  Increases the time in the EVM.
 *  @param seconds Number of seconds to increase the time by
 */
const fastForward = async seconds => {
  // It's handy to be able to be able to pass big numbers in as we can just
  // query them from the contract, then send them back. If not changed to
  // a number, this causes much larger fast forwards than expected without error.
  if (BN.isBN(seconds)) seconds = seconds.toNumber();

  // And same with strings.
  if (typeof seconds === 'string') seconds = parseFloat(seconds);

  await send({
    method: 'evm_increaseTime',
    params: [seconds],
  });

  await mineBlock();
};

const getChainContracts = () => {
  let NETWORK = config.network;//process.env.NETWORK;
  console.log("network: " +NETWORK);
  var contracts = {};

  if(NETWORK == "debugFraxtal" || NETWORK == "mainnetFraxtal"){
    contracts = contractList.fraxtal;
  }

  return contracts;
}

const advanceTime = async (secondsElaspse) => {
  await fastForward(secondsElaspse);
  console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
}
const day = 86400;

contract("Deploy System and test staking/rewards", async accounts => {
  it("should deploy contracts and test various functions", async () => {

    let chainContracts = getChainContracts();
    let deployer = chainContracts.system.deployer;
    let multisig = chainContracts.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"
    let voteproxy = "0x59CFCD384746ec3035299D90782Be065e466800B";

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

    
    await unlockAccount(deployer);

    console.log("\n\n >>>> deploy system >>>>")

    //system
    var usingproxy = await FraxtalVoterProxy.at(chainContracts.system.voteProxy);

    var booster = await FraxtalBooster.new(usingproxy.address, chainContracts.frax.vefxs, chainContracts.frax.fpisLocker, {from:deployer});
    console.log("deployed booster to " +booster.address);
    chainContracts.system.booster = booster.address;
    console.log("using booster at: " +booster.address);
    await booster.setVefxsDistro(chainContracts.frax.vefxsRewardDistro,chainContracts.frax.fxs, chainContracts.system.stakedCvxFxs, {from:deployer})
    await booster.setExtraDistro(chainContracts.system.rewardDistribution, chainContracts.system.bridgeReceiver, {from:deployer})
    await booster.setFeeInfo(chainContracts.system.treasury,500,{from:deployer})
    await booster.setFxsDepositor(chainContracts.system.fxsDepositor,{from:deployer})
    await booster.setFpisLocker(chainContracts.system.fpisLockController,{from:deployer})
    console.log("booster initialized");

    //set proxy operator
    var boosterold = await FraxtalBooster.at(await usingproxy.operator());
    await boosterold.isShutdown().then(a=>console.log("isShutdown " +a))
    await boosterold.shutdownSystem({from:deployer});
    console.log("shutdown");
    await boosterold.isShutdown().then(a=>console.log("isShutdown " +a))
    await usingproxy.setOperator(booster.address,{from:deployer});
    console.log("set voterproxy operator");
    await usingproxy.operator().then(a=>console.log("operator: "+a))

    // var poolUtil = await FraxtalPoolUtilities.new();
    // chainContracts.system.poolUtility = poolUtil.address;

    // var fxs = await IERC20.at(chainContracts.frax.fxs);
    // var rewards = await RewardDistribution.at(chainContracts.system.rewardDistribution);
    // await fxs.balanceOf(booster.address).then(a=>console.log("booster balance; " +a));
    // await fxs.balanceOf(chainContracts.system.stakedCvxFxs).then(a=>console.log("stakedCvxFxs balance; " +a));
    // await fxs.balanceOf(rewards.address).then(a=>console.log("rewards balance; " +a));
    // await poolUtil.stakedCvxFxsRewardRates().then(a=>console.log("rate " +a.rates[0].toString()));

    // await booster.claimFees();
    // console.log("claimFees");
    
    // await fxs.balanceOf(booster.address).then(a=>console.log("booster balance; " +a));
    // await fxs.balanceOf(chainContracts.system.stakedCvxFxs).then(a=>console.log("stakedCvxFxs balance; " +a));
    // await fxs.balanceOf(rewards.address).then(a=>console.log("rewards balance; " +a));
    // await poolUtil.stakedCvxFxsRewardRates().then(a=>console.log("rate " +a.rates[0].toString()));

    // await advanceTime(day);

    // await booster.claimFees();
    // console.log("claimFees");
    
    // await fxs.balanceOf(booster.address).then(a=>console.log("booster balance; " +a));
    // await fxs.balanceOf(chainContracts.system.stakedCvxFxs).then(a=>console.log("stakedCvxFxs balance; " +a));
    // await fxs.balanceOf(rewards.address).then(a=>console.log("rewards balance; " +a));

    console.log("\n\n --- deployed ----");

    console.log(chainContracts);
    if(config.network == "mainnetFraxtal"){
      contractList.fraxtal = chainContracts;
      jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    }
    

    return;
  });
});


