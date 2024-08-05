// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

// const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
// const FraxtalBooster = artifacts.require("FraxtalBooster");
// const FraxtalFxsDepositor = artifacts.require("FraxtalFxsDepositor");
const StakedCvxFxs = artifacts.require("StakedCvxFxs");
// const cvxToken = artifacts.require("cvxToken");
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
        // method: "anvil_impersonateAccount",
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

    web3.eth.getBlockNumber().then(console.log);
    await unlockAccount(deployer);
    await unlockAccount(multisig);

    var migraterole;
    var fxb;
    var fraxlend;
    var frax;
    var sfrax;
    var sfraxVault;
    var stakedfrax;
    var exchange;
    var holderfxb;
    var holderfrax;
    if(config.network == "debug"){
      //mainnet debug
      migraterole = multisig;
      fxb = await IERC20.at("0x76237BCfDbe8e06FB774663add96216961df4ff3");
      fraxlend = await IFraxLend.at("0x1c0C222989a37247D974937782cebc8bF4f25733");
      frax = await IERC20.at(chainContracts.frax.frax);
      sfrax = await IERC20.at(chainContracts.frax.sfrax);
      sfraxVault = await IERC4626.at(sfrax.address);
      stakedfrax = await IStakedFrax.at(chainContracts.frax.sfrax);
      exchange = "0xe035e27A8eD6842b478933820f90093D205F7098"; //mainnet
      holderfxb = "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC";
      holderfrax = "0xcE6431D21E3fb1036CE9973a3312368ED96F5CE7";
    }else{
      //fraxtal
      migraterole = "0xC4EB45d80DC1F079045E75D5d55de8eD1c1090E6"; //frax comptroller
      fxb = await IERC20.at("0xF1e2b576aF4C6a7eE966b14C810b772391e92153");
      fraxlend = await IFraxLend.at("0x3e92765eE2B009b104A8A7baf3759B159c19AbA1");
      frax = await IERC20.at(chainContracts.frax.frax);
      sfrax = await IERC20.at(chainContracts.frax.sfrax);
      sfraxVault = await IERC4626.at(chainContracts.frax.sfraxVault);
      stakedfrax = await IStakedFrax.at(chainContracts.frax.sfraxVault);
      exchange = "0xeE454138083b9B9714cac3c7cF12560248d76D6B";
      holderfxb = "0xb29002BF776066BF8d73B3F0597cA8B894E30050";
      holderfrax = "0x00160baF84b3D2014837cc12e838ea399f8b8478";
    }
    await unlockAccount(holderfxb);
    await unlockAccount(holderfrax);
    await unlockAccount(migraterole);


    //deploy
    console.log("--- deploy ---");
    if(config.network == "mainnetFraxtal"){
      var checkbalance = await fxb.balanceOf(deployer);
      if(checkbalance != web3.utils.toWei("1.0", "ether")){
        console.log("deploy with 1.0 fxb on deployer")
        return;
      }
    }
    var cvxfxb = await cvxFXB.new(fxb.address, fraxlend.address, frax.address, sfrax.address, sfraxVault.address, migraterole, {from:deployer});
    console.log("cvxfxb: " +cvxfxb.address);
    await cvxfxb.sfrax().then(a=>console.log("using sfrax: " +a))
    chainContracts.system.cvxfxb = cvxfxb.address;

    var swapper = await cvxFXBSwapper.new(cvxfxb.address, fxb.address, frax.address, fraxlend.address, exchange, {from:deployer})
    console.log("swapper: " +swapper.address)
    chainContracts.system.cvxfxbSwapper = swapper.address;

    //current oracle price and market price are quite different and thus need a big slippage setting
    await swapper.setSlippage(web3.utils.toWei("0.80", "ether"),{from:deployer})
    console.log("slippage set");

    await cvxfxb.setSwapper(swapper.address,{from:deployer});
    await cvxfxb.setSwapBuffer(web3.utils.toWei("10.0", "ether"),{from:deployer});
    console.log("swapper set")

    await cvxfxb.setFees(chainContracts.system.treasury,10000,{from:deployer});
    console.log("set fees");

    var cvxfxbRates = await cvxFXBRateCalc.new(cvxfxb.address, frax.address, sfraxVault.address, fraxlend.address, {from:deployer})
    await cvxfxb.setOperator(cvxfxbRates.address,{from:deployer})
    console.log("rates: " +cvxfxbRates.address);
    chainContracts.system.cvxfxbOperator = cvxfxbRates.address;

    console.log("\n\n --- deployed ----");

    console.log(chainContracts);
    if(config.network == "mainnetFraxtal"){
      contractList.fraxtal = chainContracts;
      jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
      
      await fxb.transfer(cvxfxb.address, web3.utils.toWei("1.0", "ether"),{from:deployer})

      console.log("done");
      return;
    }
    
    await swapper.setSlippage(web3.utils.toWei("0.79", "ether"),{from:deployer})
    console.log("slippage set");

    //get tokens
    await setNoGas();
    await fxb.transfer(cvxfxb.address, web3.utils.toWei("1.0", "ether"),{from:holderfxb,gasPrice:0})
    await fxb.transfer(userA, web3.utils.toWei("800000.0", "ether"),{from:holderfxb,gasPrice:0})
    await frax.transfer(userA, web3.utils.toWei("1000000.0", "ether"),{from:holderfrax,gasPrice:0})
    await frax.transfer(cvxfxb.address, web3.utils.toWei("100.0", "ether"),{from:holderfrax,gasPrice:0})
    await fxb.balanceOf(userA).then(a=>console.log("fxb balance: " +a))
    await frax.balanceOf(userA).then(a=>console.log("frax balance: " +a))

    // await cvxfxb.setUtilBounds(60000,{from:deployer});
    // console.log("set util bounds");

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
      await rates.needsUpdate().then(a=>console.log("cvxfxb needsUpdate?: " +a));
      await rates.calcBorrowUpdate().then(a=>console.log("cvxfxb calcBorrowUpdate?: " +a));
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

    //make sure low amouts of frax is handled
    await cvxfxb.setOperator(addressZero,{from:deployer})
    await cvxfxb.updateBalances();
    await frax.balanceOf(cvxfxb.address).then(a=>console.log("frax on cvxfxb: " +a))
    await sfrax.balanceOf(cvxfxb.address).then(a=>console.log("sfrax on cvxfxb: " +a))
    await frax.transfer(cvxfxb.address, 1,{from:holderfrax,gasPrice:0})
    await cvxfxb.updateBalances();
    await frax.balanceOf(cvxfxb.address).then(a=>console.log("frax on cvxfxb: " +a))
    await sfrax.balanceOf(cvxfxb.address).then(a=>console.log("sfrax on cvxfxb: " +a))
    await cvxfxb.setOperator(cvxfxbRates.address,{from:deployer})


    await advanceTime(day * 1);
    await report();

    await fraxlend.userCollateralBalance(cvxfxb.address).then(a=>console.log("userCollateralBalance: " +a));
    await frax.balanceOf(chainContracts.system.treasury).then(a=>console.log("frax on treasury: " +a))
    await cvxfxb.processRewards().catch(a=>console.log("REVERT ON PROCESS REWARDS " +a));
    console.log("rewards processed")
    await fraxlend.userCollateralBalance(cvxfxb.address).then(a=>console.log("userCollateralBalance: " +a));
    await frax.balanceOf(chainContracts.system.treasury).then(a=>console.log("frax on treasury: " +a))

    await cvxfxb.getProfit().then(a=>console.log("getProfit: " +a))
    await report();

    // return;
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
    var newfxb = await IERC20.at("0xacA9A33698cF96413A40A4eB9E87906ff40fC6CA");
    var newfraxlend = await IFraxLend.at("0x1b48c9595385F1780d7Be1aB57f8eAcFeA3A5cE5");
    var newfxbholder = "0x6e6B61369A4f549FF3A7c9E0CFA5F7E8Ada5CD22";
    await unlockAccount(newfxbholder);
    var migrator = await cvxFXBMigrator.new(cvxfxb.address, fxb.address, newfxb.address, newfraxlend.address, {from:deployer})
    console.log("migrator deployed to " +migrator.address);
    await newfxb.transfer(migrator.address, web3.utils.toWei("100000.0", "ether"),{from:newfxbholder,gasPrice:0})
    await newfxb.transfer(userA, web3.utils.toWei("1000.0", "ether"),{from:newfxbholder,gasPrice:0})

    await cvxfxb.setMigrationContract(migrator.address,{from:migraterole,gasPrice:0});
    await cvxfxb.migrate({from:migraterole,gasPrice:0}).catch(a=>console.log("too soon: " +a));
    await advanceTime(8 * day);
    // await stakedfrax.syncRewardsAndDistribution();
    await frax.transfer(cvxfxb.address, web3.utils.toWei("1000.0", "ether"),{from:holderfrax,gasPrice:0})
    // await report();
    console.log("migrating...");
    await cvxfxb.migrationTime().then(a=>console.log("migration time: " +a))
    await currentTime().then(console.log);
    await cvxfxb.migrate({from:migraterole,gasPrice:0});
    console.log("migrated")
    var newcvxfxbRates = await cvxFXBRateCalc.new(cvxfxb.address, sfrax.address, newfraxlend.address, {from:deployer})
    await cvxfxb.setOperator(newcvxfxbRates.address,{from:deployer}).catch(a=>console.log("too soon: " +a));
    await advanceTime(8 * day);
    await cvxfxb.setOperator(newcvxfxbRates.address,{from:deployer})

    // await report();
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


