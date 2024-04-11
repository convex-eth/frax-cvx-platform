// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const FraxtalVoterProxy = artifacts.require("FraxtalVoterProxy");
const FraxtalBooster = artifacts.require("FraxtalBooster");
const FraxtalFxsDepositor = artifacts.require("FraxtalFxsDepositor");
const StakedCvxFxs = artifacts.require("StakedCvxFxs");
const cvxToken = artifacts.require("cvxToken");
const IFraxtalVoteEscrow = artifacts.require("IFraxtalVoteEscrow");

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

    var voteproxy = await FraxtalVoterProxy.at(chainContracts.system.voteProxy);
    var oldbooster = await FraxtalBooster.at(chainContracts.system.booster);
    var fxs = await IERC20.at(chainContracts.frax.fxs);
    var cvxfxs = await cvxToken.at(chainContracts.system.cvxFxs);
    var vefxs = await IFraxtalVoteEscrow.at(chainContracts.frax.vefxs);

    //deploy
    var booster = await FraxtalBooster.new(voteproxy.address, chainContracts.frax.vefxs, {from:deployer});
    console.log("booster: " +booster.address);
    var depositor = await FraxtalFxsDepositor.new(voteproxy.address, cvxfxs.address, fxs.address, {from:deployer});
    console.log("fxsDepositor: " +depositor.address)
    await booster.setFxsDepositor(depositor.address,{from:deployer});
    console.log("set depositor on booster");
    var stakedcvxfxs = await StakedCvxFxs.new(cvxfxs.address, fxs.address, voteproxy.address, {from:deployer});
    console.log("stkcvxfxs: " +stakedcvxfxs.address);

    //replace
    await oldbooster.shutdownSystem({from:deployer});
    await voteproxy.setOperator(booster.address,{from:deployer});
    console.log("replaced");

    var fxsbalance = web3.utils.toWei("5.0", "ether");//await fxs.balanceOf(deployer);
    console.log("fxsbalance: " +fxsbalance);
    await fxs.transfer(voteproxy.address, fxsbalance,{from:deployer});
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("balance on voteproxy: " +a))

    //set mint role on depositor
    var minterdata = cvxfxs.contract.methods.setOperator(depositor.address,true).encodeABI();
    console.log(minterdata);

    await booster.execute(cvxfxs.address, minterdata, {from:deployer});
    console.log("depositor given mint role")
    await cvxfxs.operators(depositor.address).then(a=>console.log("depositor is operator? " +a));
    
    //set approval for fxs to vefxs
    var approvaldata = fxs.contract.methods.approve(chainContracts.frax.vefxs,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    await booster.execute(fxs.address, approvaldata, {from:deployer});
    console.log("set fxs approval on proxy to vefxs")

    //create lock
    var unlocktime = Number(await currentTime()) + (4 * 365 * 86400) - (7 * 86400);
    console.log("unlocktime: " +unlocktime);
    await booster.createLock(fxsbalance,unlocktime,{from:deployer});
    console.log("lock created");
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));

    if(config.network == "mainnetFraxtal"){
      console.log("done");
      return;
    }

    //test deposits
    console.log("\n\ntest deposits >>>")
    //get more fxs
    var fxsholder = "0xb4da8da10fff1f6127ab71395053aa1d499b503f";
    await unlockAccount(fxsholder);
    await setNoGas();
    await fxs.transfer(userA, web3.utils.toWei("1000.0", "ether"),{from:fxsholder,gasPrice:0})
    await fxs.balanceOf(userA).then(a=>console.log("transfered fxs: " +a))

    //approvals
    await fxs.approve(depositor.address, web3.utils.toWei("1000.0", "ether"), {from:userA});
    await fxs.approve(stakedcvxfxs.address, web3.utils.toWei("1000.0", "ether"), {from:userA});
    await cvxfxs.approve(stakedcvxfxs.address, web3.utils.toWei("1000.0", "ether"), {from:userA});
    console.log("approved");

    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))

    await depositor.deposit(web3.utils.toWei("1.0", "ether"), addressZero, {from:userA});
    console.log("\ndeposited in fxsdepositor")
    await fxs.balanceOf(depositor.address).then(a=>console.log("balance of depositor fxs: " +a))
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("balance of voteproxy fxs: " +a))
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));

    await depositor.deposit(web3.utils.toWei("1.0", "ether"), stakedcvxfxs.address, {from:userA});
    console.log("\ndeposited + stake")
    await fxs.balanceOf(depositor.address).then(a=>console.log("balance of depositor fxs: " +a))
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("balance of voteproxy fxs: " +a))
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));

    await stakedcvxfxs.stake(web3.utils.toWei("1.0", "ether"), userA, {from:userA});
    console.log("\nstaked in staking")
    await fxs.balanceOf(depositor.address).then(a=>console.log("balance of depositor fxs: " +a))
    await fxs.balanceOf(voteproxy.address).then(a=>console.log("balance of voteproxy fxs: " +a))
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));

    await stakedcvxfxs.withdraw(web3.utils.toWei("0.5", "ether"), true, {from:userA});
    console.log("\nwithdraw from staking")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await stakedcvxfxs.withdrawAll(true, {from:userA});
    console.log("withdrawall from staking")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))

    await stakedcvxfxs.stakeFor(userB, web3.utils.toWei("1.0", "ether"), {from:userA});
    console.log("\nstaked for userB")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userB).then(a=>console.log("balance of userB stakedcvxfxs: " +a))


    await advanceTime(7 * day * 4);
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await depositor.deposit(web3.utils.toWei("1.0", "ether"), addressZero, {from:userA});
    console.log("\ndeposited in fxsdepositor")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await advanceTime(day);
    await depositor.deposit(web3.utils.toWei("1.0", "ether"), addressZero, {from:userA});
    console.log("\ndeposited in fxsdepositor")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await advanceTime(day);
    await depositor.deposit(web3.utils.toWei("10.0", "ether"), addressZero, {from:userA});
    console.log("\ndeposited in fxsdepositor")
    await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))
    await vefxs.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    

    await stakedcvxfxs.deposit(web3.utils.toWei("1.0", "ether"), userA, {from:userA});
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await stakedcvxfxs.mint(web3.utils.toWei("1.0", "ether"), userA, {from:userA});
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await stakedcvxfxs.redeem(web3.utils.toWei("1.0", "ether"), userA, userA, {from:userA});
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))
    await stakedcvxfxs.redeem(web3.utils.toWei("1.0", "ether"), userA, userB, {from:userA}).catch(a=>console.log("revert catch: " +a));
    await stakedcvxfxs.balanceOf(userA).then(a=>console.log("balance of userA stakedcvxfxs: " +a))

    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));
    await stakedcvxfxs.methods['getReward(address)'](userA, {from:userB});
    console.log("claimed");
    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));
    
    await setNoGas();
    await fxs.transfer(stakedcvxfxs.address, web3.utils.toWei("1.0", "ether"),{from:fxsholder,gasPrice:0})
    console.log("add rewards")

    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));
    await stakedcvxfxs.methods['getReward(address)'](userA, {from:userB});
    console.log("claimed");
    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));

    await setNoGas();
    await fxs.transfer(stakedcvxfxs.address, web3.utils.toWei("1.0", "ether"),{from:fxsholder,gasPrice:0})
    console.log("add rewards")

    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));
    await stakedcvxfxs.methods['getReward(address)'](userA, {from:userB});
    console.log("claimed");
    await fxs.balanceOf(userA).then(a=>console.log("balance of userA fxs: " +a))
    await stakedcvxfxs.earned.call(userA).then(a=>console.log("earned: " +JSON.stringify(a) ));


    return;

  });
});


