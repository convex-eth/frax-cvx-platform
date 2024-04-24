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
    var booster = await FraxtalBooster.at(chainContracts.system.booster);
    var fpisBooster = await FraxtalBooster.at(chainContracts.system.fpisBooster);
    var fxs = await IERC20.at(chainContracts.frax.fxs);
    var fpis = await IERC20.at(chainContracts.frax.fpis);
    var cvxfxs = await cvxToken.at(chainContracts.system.cvxFxs);
    var cvxfpis = await cvxToken.at(chainContracts.system.cvxFpis);
    var vefxs = await IFraxtalVoteEscrow.at(chainContracts.frax.vefxs);

    //deploy
    var migrate = await FpisMigrate.new(chainContracts.frax.fpis, chainContracts.system.cvxFpis, chainContracts.system.cvxFxs, "3", {from:deployer});
    console.log("migrator: " +migrate.address);

    //set mint role on migrate
    var minterdata = cvxfxs.contract.methods.setOperator(migrate.address,true).encodeABI();
    // console.log(minterdata);

    await booster.execute(cvxfxs.address, minterdata, {from:deployer});
    // console.log("migrate given mint role of cvxfxs")
    // await cvxfxs.operators(migrate.address).then(a=>console.log("migrator is operator of cvxfxs? " +a));

    
    //get more fpis
    var holder = "0xcD3A040f05769d7628582B403063e61B7D212F91";
    await unlockAccount(holder);
    await setNoGas();
    await fpis.transfer(userA, web3.utils.toWei("1000.0", "ether"),{from:holder,gasPrice:0})
    await fpis.balanceOf(userA).then(a=>console.log("transfered fpis: " +a))
    await setNoGas();
    var minterdata = cvxfxs.contract.methods.setOperator(deployer,true).encodeABI();
    await fpisBooster.execute(cvxfpis.address, minterdata, {from:deployer});
    // console.log("deployer given mint role of cvxfpis")
    // await cvxfpis.operators(deployer).then(a=>console.log("deployer is operator of cvxfpis? " +a));
    await cvxfpis.mint(userA, web3.utils.toWei("1000.0", "ether"), {from:deployer,gasPrice:0})
    await cvxfpis.balanceOf(userA).then(a=>console.log("transfered cvxfpis: " +a))

    return;

  });
});


