// const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { BN, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const IERC20 = artifacts.require("IERC20");
const TreasuryManagerFrax = artifacts.require("TreasuryManagerFrax");
const IConvexDeposits = artifacts.require("IConvexDeposits");
const IFraxFarmERC20_V2 = artifacts.require("IFraxFarmERC20_V2");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");


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

contract("Test actions for treasury using fxs gauge vaults", async accounts => {
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
      await fastForward(secondsElaspse);
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;
    const fullLock = 94608000;
    const testLockTime = 594000 * 2;
    const convexPoolId = 168;

    await unlockAccount(deployer);
    await unlockAccount(multisig);
    await unlockAccount(treasury);

    var testlive = true;

    var manager;
    if(!testlive){
      manager = await TreasuryManagerFrax.new({from:deployer});
    }else{
      manager = await TreasuryManagerFrax.at(contractList.system.treasuryManagerCvxFrxeth);
    } 
    
    console.log("manager: " +manager.address)

    var frxeth = await IERC20.at(contractList.frax.frxeth);
    var sfrxeth = await IERC20.at(contractList.frax.sfrxeth);
    var wsteth = await IERC20.at("0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0");
    var fraxpool = await IFraxFarmERC20_V2.at("0xb01BaB994b52A37a231551f00a1B7cAcd43bc8C9");

    // var approvedata = frxeth.contract.methods.approve(manager.address,"115792089237316195423570985008687907853269984665640564039457584007913129639935").encodeABI();
    // console.log("approve calldata: " +approvedata);

    // return;


    var sfrxethholder = "0x78bB3aEC3d855431bd9289fD98dA13F9ebB7ef15";
    await unlockAccount(sfrxethholder);
    await unlockAccount(sfrxeth.address);
    await frxeth.transfer(treasury,web3.utils.toWei("100.0", "ether"),{from:sfrxeth.address,gasPrice:0})
    await sfrxeth.transfer(treasury,web3.utils.toWei("100.0", "ether"),{from:sfrxethholder,gasPrice:0})
    await frxeth.balanceOf(treasury).then(a=>console.log("treasury balance frxeth: " +a));
    await sfrxeth.balanceOf(treasury).then(a=>console.log("treasury balance sfrxeth: " +a));
    let vault = await StakingProxyConvex.at(await manager.vault());
    console.log("vault: " +vault.address);
    
    if(!testlive){
      await frxeth.approve(manager.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
      await sfrxeth.approve(manager.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
      await wsteth.approve(manager.address,web3.utils.toWei("100000000000.0", "ether"),{from:treasury,gasPrice:0});
    }

    console.log("\n\n >>> Swap >>>>\n");
    await manager.treasuryBalanceOfFrxEth().then(a=>console.log("treasury frxeth: " +a));
    await manager.treasuryBalanceOfSFrxEth().then(a=>console.log("treasury sfrxeth: " +a));
    await manager.balanceOfCvx().then(a=>console.log("manager cvx: " +a));
    await manager.treasuryBalanceOfWstEth().then(a=>console.log("treasury wsteth: " +a));

    var amount = web3.utils.toWei("1.0", "ether");
    console.log("swapping: " +amount);
    await manager.slippage().then(a=>console.log("slippage allowance: " +a))
    var minOut = await manager.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await manager.swapWStethToFrxEth(amount,minOut,false,{from:deployer});

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await sfrxeth.balanceOf(treasury).then(a=>console.log("treasury sfrxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await wsteth.balanceOf(treasury).then(a=>console.log("treasury wsteth: " +a));

    console.log("swap again but wrap to sfrxeth")
    var minOut = await manager.calc_minOut_swap(amount);
    console.log("calc out: " +minOut);
    await manager.swapWStethToFrxEth(amount,minOut,true,{from:deployer});

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await sfrxeth.balanceOf(treasury).then(a=>console.log("treasury sfrxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await wsteth.balanceOf(treasury).then(a=>console.log("treasury wsteth: " +a));

    console.log("\n\n >>> Swap END>>>>");

    console.log("\n\n >>> Add LP >>>>");
    
    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));

    var amountfrxeth = web3.utils.toWei("10.0", "ether");
    // var amountcvx = web3.utils.toWei("1000.0", "ether");
    var amountcvx = web3.utils.toWei("0.0", "ether");
    console.log("add to LP frxeth: " +amountfrxeth);
    console.log("add to LP cvx: " +amountcvx);

    var minOut = await manager.calc_minOut_deposit(0,amountfrxeth,amountcvx);
    console.log("minOut: " +minOut);

    await manager.addToPool(0,amountfrxeth, amountcvx, minOut, 0, testLockTime, {from:deployer});

    var kek = await manager.kekmap(0);
    console.log("added with kek " +kek);

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity: " +lockedstakes[0].liquidity);

    console.log("add additional using sfrxeth...");

    await sfrxeth.balanceOf(treasury).then(a=>console.log("treasury sfrxeth: " +a));
    var amountsfrxeth = web3.utils.toWei("10.0", "ether");
    var minOut = await manager.calc_minOut_deposit(amountsfrxeth,0,0);
    console.log("minOut: " +minOut);
    await manager.calc_minOut_deposit(0,amountsfrxeth,0).then(a=>console.log("(min out if was normal frxeth: " +a +")"));
    await manager.addToPool(amountsfrxeth, 0, 0, minOut, 0, testLockTime, {from:deployer});

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity: " +lockedstakes[0].liquidity);

    console.log("add additional using sfrxeth on different slot...");

    await sfrxeth.balanceOf(treasury).then(a=>console.log("treasury sfrxeth: " +a));
    var amountsfrxeth = web3.utils.toWei("10.0", "ether");
    var minOut = await manager.calc_minOut_deposit(amountsfrxeth,0,0);
    console.log("minOut: " +minOut);
    await manager.calc_minOut_deposit(0,amountsfrxeth,0).then(a=>console.log("(min out if was normal frxeth: " +a +")"));
    await manager.addToPool(amountsfrxeth, 0, 0, minOut, 1, testLockTime, {from:deployer});
    var kek = await manager.kekmap(1);
    console.log("added with kek " +kek);

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity[0]: " +lockedstakes[0].liquidity);
    console.log("locked liquidity[1]: " +lockedstakes[1].liquidity);

    console.log("\n\n >>> Add LP END>>>>");

    // return;

    await advanceTime(day);
    await booster.earmarkRewards(convexPoolId);
    await advanceTime(day);

    console.log("\n\n >>> Remove LP one side >>>>");

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));

    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    var lpbal = lockedstakes[0].liquidity;
    console.log("remove LP: " +lpbal);
    var minOut = await manager.calc_withdraw_one_coin(lpbal);
    console.log("minOut: " +minOut);

    await advanceTime(testLockTime + day)

    await manager.removeFromPool(0, minOut,{from:deployer});

    var lptoken = await IERC20.at(await manager.lptoken());
    await lptoken.balanceOf(manager.address).then(a=>console.log("manager lptoken: " +a));
    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));

    console.log("\n\n >>> Remove LP one side END>>>>");



    console.log("\n\n >>> Add LP 2>>>>");
    
    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));

     var amountfrxeth = web3.utils.toWei("10.0", "ether");
    // var amountcvx = web3.utils.toWei("1000.0", "ether");
    var amountcvx = web3.utils.toWei("0.0", "ether");
    console.log("add to LP frxeth: " +amountfrxeth);
    console.log("add to LP cvx: " +amountcvx);

    var minOut = await manager.calc_minOut_deposit(0,amountfrxeth,amountcvx);
    console.log("minOut: " +minOut);

    await manager.addToPool(0, amountfrxeth, amountcvx, minOut, 0, testLockTime, {from:deployer});

    var kek = await manager.kekmap(0);
    console.log("added with kek " +kek);

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity[0]: " +lockedstakes[0].liquidity);
    console.log("locked liquidity[1]: " +lockedstakes[1].liquidity);

    console.log("\n\n >>> Add LP END 2>>>>");

    await advanceTime(day);
    await booster.earmarkRewards(convexPoolId);
    await advanceTime(day);

    console.log("\n\n >>> claim rewards >>>>");

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));

    await manager.claimLPRewards({from:deployer});
    console.log("\nclaimed lp rewards\n");

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));

    console.log("\n\n >>>  end claim rewards >>>>");


    await advanceTime(day);
    await booster.earmarkRewards(convexPoolId);
    await advanceTime(day);

    console.log("\n\n >>> Remove LP >>>>");

    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("lockedstakes: " +JSON.stringify(lockedstakes));
    console.log("locked liquidity: " +lockedstakes[1].liquidity);

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    var lptoken = await IERC20.at(await manager.lptoken());
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await cvxCrv.balanceOf(manager.address).then(a=>console.log("manager cvxCrv: " +a));
    await lptoken.balanceOf(manager.address).then(a=>console.log("manager lptoken: " +a));

    await advanceTime(testLockTime + day)
    await manager.removeAsLP(0, {from:deployer});
    console.log("removed as lp");

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await fxs.balanceOf(treasury).then(a=>console.log("treasury fxs: " +a));
    await crv.balanceOf(treasury).then(a=>console.log("treasury crv: " +a));
    await cvx.balanceOf(treasury).then(a=>console.log("treasury cvx: " +a));
    await lptoken.balanceOf(treasury).then(a=>console.log("treasury lptoken: " +a));

    await crv.balanceOf(manager.address).then(a=>console.log("manager crv: " +a));
    await frxeth.balanceOf(manager.address).then(a=>console.log("manager frxeth: " +a));
    await lptoken.balanceOf(manager.address).then(a=>console.log("manager lptoken: " +a));

    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("lockedstakes: " +JSON.stringify(lockedstakes));
    console.log("locked liquidity: " +lockedstakes[0].liquidity);

    console.log("\n\n >>> Remove LP END>>>>");


    console.log("\n\n >>> Add LP 3>>>>");
    
    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));

     var amountfrxeth = web3.utils.toWei("10.0", "ether");
    // var amountcvx = web3.utils.toWei("1000.0", "ether");
    var amountcvx = web3.utils.toWei("0.0", "ether");
    console.log("add to LP frxeth: " +amountfrxeth);
    console.log("add to LP cvx: " +amountcvx);

    var minOut = await manager.calc_minOut_deposit(0,amountfrxeth,amountcvx);
    console.log("minOut: " +minOut);

    await manager.addToPool(0, amountfrxeth, amountcvx, minOut, 0, testLockTime, {from:deployer});

    var kek = await manager.kekmap(0);
    console.log("added with kek " +kek);

    await frxeth.balanceOf(treasury).then(a=>console.log("treasury frxeth: " +a));
    await cvx.balanceOf(manager.address).then(a=>console.log("manager.address cvx: " +a));
    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity[0]: " +lockedstakes[0].liquidity);
    console.log("ending_timestamp[0]: " +lockedstakes[0].ending_timestamp);

    console.log("lock longer...");
    var newtime = await currentTime();
    console.log("current: " +newtime);
    newtime = newtime +testLockTime +(day*10);
    console.log("newtime: " +newtime);
    await manager.lockLonger(0, newtime, {from:deployer});

    await fraxpool.lockedStakesOf(vault.address).then(a=>console.log("staked lp: " +JSON.stringify(a) ));
    var lockedstakes = await fraxpool.lockedStakesOf(vault.address);
    console.log("locked liquidity[0]: " +lockedstakes[0].liquidity);
    console.log("ending_timestamp[0]: " +lockedstakes[0].ending_timestamp);

    console.log("\n\n >>> Add LP END 3>>>>");
  });
});


