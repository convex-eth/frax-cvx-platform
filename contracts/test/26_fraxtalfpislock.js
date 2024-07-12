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
const FpisMigrate = artifacts.require("FpisMigrate");
const FraxtalFpisLocker = artifacts.require("FraxtalFpisLocker");

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
    await unlockAccount(multisig);

    var voteproxy = await FraxtalVoterProxy.at(chainContracts.system.voteProxy);
    var oldbooster = await FraxtalBooster.at(await voteproxy.operator());
    // var fpisBooster = await FraxtalBooster.at(chainContracts.system.fpisBooster);
    var fxs = await IERC20.at(chainContracts.frax.fxs);
    var fpis = await IERC20.at(chainContracts.frax.fpis);
    // var cvxfxs = await cvxToken.at(chainContracts.system.cvxFxs);
    // var cvxfpis = await cvxToken.at(chainContracts.system.cvxFpis);
    var vefxs = await IFraxtalVoteEscrow.at(chainContracts.frax.vefxs);
    var fpisLocker = await IFraxtalVoteEscrow.at(chainContracts.frax.fpisLocker);
    var migration = await FpisMigrate.at(chainContracts.system.fpisMigrate);
    var depositor = await FraxtalFxsDepositor.at(chainContracts.system.fxsDepositor);

    //deploy
    var lockcontroller = await FraxtalFpisLocker.new(voteproxy.address, chainContracts.system.fpisMigrate, chainContracts.frax.fpis, {from:deployer});
    console.log("lockcontroller: " +lockcontroller.address);
    chainContracts.system.fpisLockController = lockcontroller.address;

    var booster = await FraxtalBooster.new(voteproxy.address, chainContracts.frax.vefxs, chainContracts.frax.fpisLocker, {from:deployer});
    console.log("booster: " +booster.address);
    chainContracts.system.booster = booster.address;

    await booster.setVefxsDistro(chainContracts.frax.vefxsRewardDistro,chainContracts.frax.fxs, chainContracts.system.stakedCvxFxs, {from:deployer})
    await booster.setExtraDistro(chainContracts.system.rewardDistribution, chainContracts.system.bridgeReceiver, {from:deployer})
    await booster.setFeeInfo(chainContracts.system.treasury,500,{from:deployer})
    await booster.setFxsDepositor(depositor.address,{from:deployer});
    console.log("set depositor on booster");
    await booster.setFpisLocker(lockcontroller.address,{from:deployer});
    console.log("set fpis lock controller on booster");

    //replace
    await oldbooster.shutdownSystem({from:deployer});
    await voteproxy.setOperator(booster.address,{from:deployer});
    console.log("booster replaced");
    
    // var migration = await FpisMigrate.at(chainContracts.system.fpisMigrate);
    await migration.withdrawTo(fpis.address, web3.utils.toWei("1.0", "ether"), voteproxy.address, {from:deployer})
    console.log("withdrew some fpis to voteproxy from migration")
    await fpis.balanceOf(voteproxy.address).then(a=>console.log("fpis balance on voteproxy: " +a));

    //set approval for fxs to vefxs
    var approvaldata = fpis.contract.methods.approve(chainContracts.frax.fpisLocker,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    await booster.execute(fpis.address, approvaldata, {from:deployer});
    console.log("set fpis approval on proxy to fpis locker")

    var unlocktime = Number(await currentTime()) + (4 * 365 * 86400);// - (7 * 86400);
    console.log("unlocktime: " +unlocktime);
    await booster.createLock(fpisLocker.address, web3.utils.toWei("1.0", "ether"),unlocktime,{from:deployer});
    // await fpis.balanceOf(voteproxy.address).then(a=>console.log("balance on voteproxy: " +a));
    // var minterdata = fpisLocker.contract.methods.createLock(voteproxy.address,web3.utils.toWei("1.0", "ether"),unlocktime).encodeABI();
    // console.log(minterdata);

    // await booster.execute(fpisLocker.address, minterdata, {from:deployer});

    console.log("lock created");
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await fpis.balanceOf(voteproxy.address).then(a=>console.log("fpis balance on voteproxy: " +a));

    await migration.owner().then(a=>console.log("migration owner; " +a))
    await migration.setPendingOwner(lockcontroller.address, {from:deployer})
    await lockcontroller.acceptOwnership();
    console.log("migration ownership to lock controller")
    await migration.owner().then(a=>console.log("migration owner; " +a))

    //test reverting
    if(config.network != "mainnetFraxtal"){
      await lockcontroller.revertOwnership({from:deployer})
      await migration.acceptPendingOwner({from:deployer});
      console.log("revert ownership");
      await migration.owner().then(a=>console.log("migration owner; " +a))
      await migration.setPendingOwner(lockcontroller.address, {from:deployer})
      await lockcontroller.acceptOwnership();
      console.log("migration ownership to lock controller again")
      await migration.owner().then(a=>console.log("migration owner; " +a))
    }

    console.log("\n\n --- deployed ----");

    //lock whats in migration now
    await fpis.balanceOf(voteproxy.address).then(a=>console.log("balance on voteproxy: " +a))
    await fpis.balanceOf(migration.address).then(a=>console.log("balance on migration: " +a))
    await booster.fpisLocker().then(a=>console.log("fpis lock controller on booster: " +a))
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await lockcontroller.lock();
    console.log("locked")
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    
    //lock whats on deployer
    var deployerBalance = await fpis.balanceOf(deployer);
    await fpis.transfer(voteproxy.address, deployerBalance,{from:deployer});
    await fpis.balanceOf(voteproxy.address).then(a=>console.log("balance on voteproxy: " +a))
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await lockcontroller.lock();
    console.log("locked")
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));

    //force checkpoint by claiming fees
    await booster.claimFees();
    console.log("fees claimed");

    console.log(chainContracts);
    if(config.network == "mainnetFraxtal"){
      contractList.fraxtal = chainContracts;
      jsonfile.writeFileSync("./contracts.json", contractList, { spaces: 4 });
      console.log("done");
      return;
    }
    
    await advanceTime(day * 8);
    await lockcontroller.unlockTime().then(a=>console.log("unlockTime: " +a))
    await lockcontroller.nextUnlock().then(a=>console.log("nextUnlock: " +a))
    await lockcontroller.lock();
    console.log("locked")
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await advanceTime(day * 8);
    await lockcontroller.unlockTime().then(a=>console.log("unlockTime: " +a))
    await lockcontroller.nextUnlock().then(a=>console.log("nextUnlock: " +a))
    await lockcontroller.lock();
    console.log("locked")
    await fpisLocker.lockedByIndex(voteproxy.address,0).then(a=>console.log("lock amount: " +a._amount +", end: " +a._end));
    await fpis.balanceOf(voteproxy.address).then(a=>console.log("balance on voteproxy: " +a))
    await fpis.balanceOf(migration.address).then(a=>console.log("balance on migration: " +a))

    //get more fpis
    // var holder = "0xcD3A040f05769d7628582B403063e61B7D212F91";
    // await unlockAccount(holder);
    // await setNoGas();
    // await fpis.transfer(userA, web3.utils.toWei("1000.0", "ether"),{from:holder,gasPrice:0})
    // await fpis.balanceOf(userA).then(a=>console.log("transfered fpis: " +a))
    // await setNoGas();
    // var minterdata = cvxfxs.contract.methods.setOperator(deployer,true).encodeABI();
    // await fpisBooster.execute(cvxfpis.address, minterdata, {from:deployer});
    // console.log("deployer given mint role of cvxfpis")
    // await cvxfpis.operators(deployer).then(a=>console.log("deployer is operator of cvxfpis? " +a));
    // await cvxfpis.mint(userA, web3.utils.toWei("1000.0", "ether"), {from:deployer,gasPrice:0})
    // await cvxfpis.balanceOf(userA).then(a=>console.log("transfered cvxfpis: " +a))

    //approvals
    // await fpis.approve(migrate.address, web3.utils.toWei("1000.0", "ether"), {from:userA});
    // await cvxfpis.approve(migrate.address, web3.utils.toWei("1000.0", "ether"), {from:userA});
    // console.log("approved");

    // await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    // await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))

    // await migrate.migrate(web3.utils.toWei("1000.0", "ether"), 0, {from:userA});
    // console.log("migrated fpis")

    // await fpis.balanceOf(migrate.address).then(a=>console.log("balance of migration fpis: " +a))
    // await cvxfpis.balanceOf(migrate.address).then(a=>console.log("balance of migration cvxfpis: " +a))
    // await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    // await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))

    // await migrate.migrate(0,web3.utils.toWei("1000.0", "ether"), {from:userA});
    // console.log("migrated cvxfpis")

    // await fpis.balanceOf(migrate.address).then(a=>console.log("balance of migration fpis: " +a))
    // await cvxfpis.balanceOf(migrate.address).then(a=>console.log("balance of migration cvxfpis: " +a))
    // await cvxfxs.balanceOf(userA).then(a=>console.log("balance of userA cvxfxs: " +a))
    // await cvxfxs.totalSupply().then(a=>console.log("supply of cvxfxs: " +a))


    // var finalbalance = await fpis.balanceOf(migrate.address);
    // await fpis.balanceOf(userB).then(a=>console.log("balance of migration withdraw point: " +a))
    // await migrate.withdrawTo(fpis.address, finalbalance, userB, {from:deployer} );
    // await fpis.balanceOf(userB).then(a=>console.log("balance of migration withdraw point: " +a))

    return;

  });
});


