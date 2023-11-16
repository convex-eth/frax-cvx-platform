// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const IERC20 = artifacts.require("IERC20");
const TreasuryManager = artifacts.require("TreasuryManager");
const IConvexDeposits = artifacts.require("IConvexDeposits");


const addAccount = async (address) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_addAccount",
        params: [address, "passphrase"],
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

const unlockAccount = async (address) => {
  let NETWORK = config.network;
  if(!NETWORK.includes("debug")){
    return null;
  }
  await addAccount(address);
  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "personal_unlockAccount",
        params: [address, "passphrase"],
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

contract("Test swapping/converting/lping and other actions for treasury", async accounts => {
  it("should test treasury actions", async () => {

    let deployer = contractList.system.deployer;
    let multisig = contractList.system.multisig;
    let addressZero = "0x0000000000000000000000000000000000000000"
    let treasury = contractList.system.treasury;
    

    //system
    let booster = await IConvexDeposits.at("0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
    let fxsDeposit = await FxsDepositor.at(contractList.system.fxsDepositor);
    let cvx = await IERC20.at(contractList.system.cvx);
    let crv = await IERC20.at("0xD533a949740bb3306d119CC777fa900bA034cd52");
    let cvxCrv = await IERC20.at("0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7");
    let cvxfxs = await IERC20.at(contractList.system.cvxFxs);
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

    const advanceTime = async (secondsElaspse) => {
      // await time.increase(secondsElaspse);
      // await time.advanceBlock();
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    await unlockAccount(deployer);
    await unlockAccount(multisig);
    await unlockAccount(treasury);

    let manager = await TreasuryManager.new({from:deployer});
    // let manager = await TreasuryManager.at(contractList.system.treasuryManager);
    console.log("manager: " +manager.address)

    var fxsApprove = fxs.contract.methods.approve(manager.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    var cvxfxsApprove = cvxfxs.contract.methods.approve(manager.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    console.log("fxs calldata: " +fxsApprove);
    console.log("cvxfxs calldata: " +cvxfxsApprove);

    return;


    await unlockAccount(vefxs.address);
    await fxs.transfer(deployer,web3.utils.toWei("10000.0", "ether"),{from:vefxs.address,gasPrice:0})
    await fxs.balanceOf(treasury).then(a=>console.log("treasury balance: " +a));
   
    
    await fxs.approve(manager.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    await cvxfxs.approve(manager.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});

    // await manager.setSlippageAllowance("995000000000000000",{from:multisig,gasPrice:0});
    // console.log("set slippage")

    console.log("\n\n >>> Swap >>>>\n");
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    var amount = web3.utils.toWei("1.0", "ether");
    console.log("swapping: " +amount);
    await manager.slippage().then(a=>console.log("slippage allowance: " +a))
    var minOut = await manager.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await manager.swap(amount,minOut,{from:deployer});

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    console.log("\n\n >>> Swap END>>>>");

    console.log("\n\n >>> Convert >>>>\n");
    
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    var amount = web3.utils.toWei("100.0", "ether");
    console.log("convert amount: " +amount);
    await manager.convert(amount,false,{from:deployer});
    
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    console.log("\n\n >>> Convert END>>>>");

    console.log("\n\n >>> Add LP >>>>");
    
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    var amountfxs = web3.utils.toWei("1.0", "ether");
    var amountcvxfxs = web3.utils.toWei("100.0", "ether");
    console.log("add to LP fxs: " +amountfxs);
    console.log("add to LP cvxfxs: " +amountcvxfxs);

    var minOut = await manager.calc_minOut_deposit(amountfxs,amountcvxfxs);
    console.log("minOut: " +minOut);

    await manager.addToPool(amountfxs, amountcvxfxs, minOut,{from:deployer});

    var lprewards = await IERC20.at(await manager.lprewards());
    console.log("lp rewards at: " +lprewards.address);

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await lprewards.balanceOf(manager.address).then(a=>console.log("staked lp: " +a));

    console.log("\n\n >>> Add LP END>>>>");

    await advanceTime(day);
    await booster.earmarkRewards(159);
    await advanceTime(day);

    console.log("\n\n >>> Remove LP one side >>>>");

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await cvxCrv.balanceOf(manager.address).then(a=>console.log("manager cvxCrv: " +a));

    var lpbal = await lprewards.balanceOf(manager.address);
    console.log("remove LP: " +lpbal);
    var minOut = await manager.calc_withdraw_one_coin(lpbal);
    console.log("minOut: " +minOut);

    await manager.removeFromPool(lpbal, minOut,{from:deployer});

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await cvxCrv.balanceOf(manager.address).then(a=>console.log("manager cvxCrv: " +a));

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>> Remove LP one side END>>>>");



    console.log("\n\n >>> Add LP 2>>>>");
    
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));

    var amountfxs = web3.utils.toWei("10.0", "ether");
    var amountcvxfxs = web3.utils.toWei("10.0", "ether");
    console.log("add to LP fxs: " +amountfxs);
    console.log("add to LP cvxfxs: " +amountcvxfxs);

    var minOut = await manager.calc_minOut_deposit(amountfxs,amountcvxfxs);
    console.log("minOut: " +minOut);

    await manager.addToPool(amountfxs, amountcvxfxs, minOut,{from:deployer});

    var lprewards = await IERC20.at(await manager.lprewards());
    console.log("lp rewards at: " +lprewards.address);

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await lprewards.balanceOf(manager.address).then(a=>console.log("staked lp: " +a));

    console.log("\n\n >>> Add LP END 2>>>>");

    await advanceTime(day);
    await booster.earmarkRewards(159);
    await advanceTime(day);

    console.log("\n\n >>> claim rewards >>>>");

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    await manager.claimLPRewards({from:deployer});
    console.log("\nclaimed lp rewards\n");

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));

    console.log("\n\n >>>  end claim rewards >>>>");


    await advanceTime(day);
    await booster.earmarkRewards(159);
    await advanceTime(day);

    console.log("\n\n >>> Remove LP >>>>");

    var lptoken = await IERC20.at(await manager.exchange()); //lptoken = pool

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await cvxCrv.balanceOf(manager.address).then(a=>console.log("manager cvxCrv: " +a));
    await lptoken.balanceOf(manager.address).then(a=>console.log("manager lptoken: " +a));

    var lpbal = await lprewards.balanceOf(manager.address);
    console.log("remove LP: " +lpbal);
    // var minOut = await manager.calc_withdraw_one_coin(lpbal);
    // console.log("minOut: " +minOut);

    await manager.removeAsLP(lpbal, {from:deployer});
    console.log("removed as lp");

    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await cvxfxs.balanceOf(treasury).then(a=>console.log("treasury cvxfxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await cvxCrv.balanceOf(manager.address).then(a=>console.log("manager cvxCrv: " +a));
    await lptoken.balanceOf(manager.address).then(a=>console.log("manager lptoken: " +a));

    console.log("\n\n >>> Remove LP END>>>>");
  });
});


