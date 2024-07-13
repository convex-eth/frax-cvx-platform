// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
const FraxtalBooster = artifacts.require("FraxtalBooster");
const FraxtalFxsDepositor = artifacts.require("FraxtalFxsDepositor");
const StakedCvxFxs = artifacts.require("StakedCvxFxs");
const cvxToken = artifacts.require("cvxToken");
const cvxFXB = artifacts.require("cvxFXB");
const cvxFXBSwapper = artifacts.require("cvxFXBSwapper");
const IFraxLend = artifacts.require("IFraxLend");
const IStakedFrax = artifacts.require("IStakedFrax");
const cvxFXBRateCalc = artifacts.require("cvxFXBRateCalc");
const cvxFXBMigrator = artifacts.require("cvxFXBMigrator");

const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");
const IERC4626 = artifacts.require("IERC4626");


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

  if(NETWORK == "debug"){
    contracts = contractList;
  }
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

contract("Deploy and test locking", async accounts => {
  it("should deploy contracts and test various functions", async () => {

    let chainContracts = getChainContracts();
    let deployer = chainContracts.system.deployer;
    let multisig = chainContracts.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"

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
    await unlockAccount(multisig);

    
    var fxb = await IERC20.at("0x76237BCfDbe8e06FB774663add96216961df4ff3");
    var fraxlend = await IFraxLend.at("0x1c0C222989a37247D974937782cebc8bF4f25733");
    var frax = await IERC20.at(chainContracts.frax.frax);
    var sfrax = await IERC20.at(chainContracts.frax.sfrax);
    var stakedfrax = await IStakedFrax.at(chainContracts.frax.sfrax);
    var exchange = "0xe035e27A8eD6842b478933820f90093D205F7098"; //mainnet
    // var exchange = "0xeE454138083b9B9714cac3c7cF12560248d76D6B"; //fraxtal


    //deploy
    console.log("--- deploy ---");
    var cvxfxb = await cvxFXB.new(fxb.address, fraxlend.address, frax.address, sfrax.address, multisig, {from:deployer});
    console.log("cvxfxb: " +cvxfxb.address);

    var swapper = await cvxFXBSwapper.new(cvxfxb.address, fxb.address, frax.address, fraxlend.address, exchange, {from:deployer})
    console.log("swapper: " +swapper.address)

    await cvxfxb.setSwapper(swapper.address,web3.utils.toWei("10.0", "ether"),{from:deployer});
    console.log("swapper set")

    var cvxfxbRates = await cvxFXBRateCalc.new(cvxfxb.address, sfrax.address, fraxlend.address, {from:deployer})
    await cvxfxb.setOperator(cvxfxbRates.address,{from:deployer})
    console.log("rates: " +cvxfxbRates.address);

    console.log("\n\n --- deployed ----");


    await cvxfxb.setUtilBounds(60000,{from:deployer});
    console.log("set util bounds");

    // console.log(chainContracts);
    // if(config.network == "mainnetFraxtal"){
    //   contractList.fraxtal = chainContracts;
    //   jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
    //   console.log("done");
    //   return;
    // }
    

    //get tokens
    var holder = "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC";
    var holderfrax = "0xcE6431D21E3fb1036CE9973a3312368ED96F5CE7";
    await unlockAccount(holder);
    await unlockAccount(holderfrax);
    await setNoGas();
    await fxb.transfer(cvxfxb.address, web3.utils.toWei("1.0", "ether"),{from:holder,gasPrice:0})
    await fxb.transfer(userA, web3.utils.toWei("800000.0", "ether"),{from:holder,gasPrice:0})
    await frax.transfer(userA, web3.utils.toWei("1000000.0", "ether"),{from:holderfrax,gasPrice:0})
    await frax.transfer(cvxfxb.address, web3.utils.toWei("100.0", "ether"),{from:holderfrax,gasPrice:0})
    await fxb.balanceOf(userA).then(a=>console.log("fxb balance: " +a))
    await frax.balanceOf(userA).then(a=>console.log("frax balance: " +a))


    await fxb.approve(cvxfxb.address, web3.utils.toWei("10000000000.0", "ether"), {from:userA});
    await cvxfxb.deposit(web3.utils.toWei("400000.0", "ether"), userA, {from:userA});
    console.log("deposited");

    const report = async (secondsElaspse) => {
      console.log("\n --- report ---")

      //update address
      var flend = await IFraxLend.at( await cvxfxb.fraxlend() );
      var currentfxb = await IERC20.at( await cvxfxb.stakingToken() );
      var rates = await cvxFXBRateCalc.at( await cvxfxb.operator() );

      var cvxfxbassets = await cvxfxb.totalAssets();
      console.log("cvxfxb totalAssets: " +cvxfxbassets);
      await cvxfxb.totalSupply().then(a=>console.log("cvxfxb totalShares: " +a));
      await flend.userBorrowShares(cvxfxb.address).then(a=>console.log("userBorrowShares: " +a));
      await flend.userCollateralBalance(cvxfxb.address).then(a=>console.log("userCollateralBalance: " +a));
      await flend.totalBorrow().then(a=>console.log("totalBorrow: " +a.assets));
      await flend.totalAsset().then(a=>console.log("totalAsset: " +a.assets));
      await rates.fraxlendCurrentUtil().then(a=>console.log("fraxlend util: " +a));
      var utilb = await cvxfxb.utilBound();
      console.log("current util bound: " +utilb);
      await cvxfxb.maxBorrowable(cvxfxbassets,utilb).then(a=>console.log("cvxfxb maxBorrowable: " +a));
      await cvxfxb.needsUpdate().then(a=>console.log("cvxfxb needs update?: " +a));
      await currentfxb.balanceOf(cvxfxb.address).then(a=>console.log("fxb on cvxfxb: " +a))
      await frax.balanceOf(cvxfxb.address).then(a=>console.log("frax on cvxfxb: " +a))
      await sfrax.balanceOf(cvxfxb.address).then(a=>console.log("sfrax on cvxfxb: " +a))
      await cvxfxb.getProfit().then(a=>console.log("getProfit: " +a))
      await rates.sfraxRates().then(a=>console.log("sfrax rates: " +a));
      await rates.fraxlendRates().then(a=>console.log("fraxlend rates: \nlow: " +a.lowRate +"\ncurrent: " +a.currentRate +"\n high: " +a.highRate +"\nlowUtil: " +a.lowUtil +"\ncurrentUtil: " +a.currentUtil +"\n highUtil: " +a.highUtil));
      await rates.rewardsPerSecond().then(a=>console.log("rewards per second: \nlow: " +a.low +"\ncurrent: " +a.current +"\n high: " +a.high));
      await rates.calcUtilBounds().then(a=>console.log("calcUtilBounds: " +a));
      var tx =  await rates.update();
      console.log("rates updated, gas: " +tx.receipt.gasUsed);
      console.log(" -------------- \n")
    }
    await report();

    await advanceTime(day * 3);
    await stakedfrax.syncRewardsAndDistribution();
    console.log("updated staked frax");

    
    await cvxfxb.getProfit().then(a=>console.log("getProfit: " +a))
    await cvxfxb.processRewards().catch(a=>console.log("REVERT ON PROCESS REWARDS " +a));
    console.log("rewards processed")
    await cvxfxb.getProfit().then(a=>console.log("getProfit: " +a))
    await report();

    await cvxfxb.deposit(web3.utils.toWei("400000.0", "ether"), userA, {from:userA});
    console.log("deposited");
    await report();
    

    await frax.approve(fraxlend.address, web3.utils.toWei("1000000000000.0", "ether"), {from:userA});
    var lendvault = await IERC4626.at(fraxlend.address);
    for(var i = 0; i < 10; i++){
      await lendvault.deposit(web3.utils.toWei("50000.0", "ether"), userA, {from:userA});
      console.log("add borrable frax");
      await report();
    }

    await cvxfxb.updateBalances();
    console.log("updated balances");
    await report();

    await cvxfxb.balanceOf(userA).then(a=>console.log("cvxfxb shares for usera: " +a))
    await cvxfxb.redeem(web3.utils.toWei("50000.0", "ether"), userA, userA, {from:userA});
    console.log("redeemed some");
    await report();


    //migration test
    var newfxb = await IERC20.at("0xF8FDe8A259A3698902C88bdB1E13Ff28Cd7f6F09");
    var newfraxlend = await IFraxLend.at("0xd1887398f3bbdC9d10D0d5616AD83506DdF5057a");
    var migrator = await cvxFXBMigrator.new(cvxfxb.address, fxb.address, newfxb.address, newfraxlend.address, {from:deployer})
    await newfxb.transfer(migrator.address, web3.utils.toWei("100000.0", "ether"),{from:holder,gasPrice:0})
    await newfxb.transfer(userA, web3.utils.toWei("1000.0", "ether"),{from:holder,gasPrice:0})

    await cvxfxb.setMigrationContract(migrator.address,{from:multisig,gasPrice:0});
    await cvxfxb.migrate({from:multisig,gasPrice:0}).catch(a=>console.log("too soon: " +a));
    await advanceTime(7 * day);
    await stakedfrax.syncRewardsAndDistribution();
    await frax.transfer(cvxfxb.address, web3.utils.toWei("1000.0", "ether"),{from:holderfrax,gasPrice:0})
    await report();
    await cvxfxb.migrate({from:multisig,gasPrice:0});
    console.log("migrated")
    var newcvxfxbRates = await cvxFXBRateCalc.new(cvxfxb.address, sfrax.address, newfraxlend.address, {from:deployer})
    await cvxfxb.setOperator(newcvxfxbRates.address,{from:deployer}).catch(a=>console.log("too soon: " +a));
    await advanceTime(7 * day);
    await cvxfxb.setOperator(newcvxfxbRates.address,{from:deployer})

    await report();
    await newfxb.approve(cvxfxb.address, web3.utils.toWei("10000000000.0", "ether"), {from:userA});
    await cvxfxb.deposit(web3.utils.toWei("1000.0", "ether"), userA, {from:userA});
    console.log("deposited new fxb");
    await report();


    await cvxfxb.redeem(await cvxfxb.balanceOf(userA), userA, userA, {from:userA});
    console.log("redeemed all");
    await report();
    
    return;

  });
});


