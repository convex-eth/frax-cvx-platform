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
const FeeDepositV2 = artifacts.require("FeeDepositV2");
const FeeReceiverVlCvx = artifacts.require("FeeReceiverVlCvx");
const IERC20 = artifacts.require("IERC20");

// const IVPool = artifacts.require("IVPool");
// const IExchange = artifacts.require("IExchange");
// const IERC20 = artifacts.require("IERC20");

// const IFraxGaugeController = artifacts.require("IFraxGaugeController");
// const IFraxRewardDistributor = artifacts.require("IFraxRewardDistributor");

const ICurveConvex = artifacts.require("ICurveConvex");


// const unlockAccount = async (address) => {
//   return new Promise((resolve, reject) => {
//     web3.currentProvider.send(
//       {
//         jsonrpc: "2.0",
//         method: "evm_unlockUnknownAccount",
//         params: [address],
//         id: new Date().getTime(),
//       },
//       (err, result) => {
//         if (err) {
//           return reject(err);
//         }
//         return resolve(result);
//       }
//     );
//   });
// };

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

contract("Update fee deposit", async accounts => {
  it("should run successfully", async () => {
    
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

    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.at(contractList.system.poolRegistry);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);
    let feeDepo = await FeeDeposit.at(contractList.system.feeDeposit);


    var newFeeDepo = await FeeDepositV2.new({from:deployer});
    console.log("new fee deposit: " +newFeeDepo.address);
    var vlcvxReceiver = await FeeReceiverVlCvx.new({from:deployer});
    console.log("vlcvx receiver: " +vlcvxReceiver.address);

    return;

    await unlockAccount(deployer);
    await unlockAccount(multisig);

    //msig stuff
    var lpstash = "0x4f3AD55D7b884CDC48ADD1e2451A13af17887F26";
    await newFeeDepo.setVlcvxReceiver(vlcvxReceiver.address, true, false,{from:multisig,gasPrice:0});
    await newFeeDepo.setCvxFxsReceiver(lpstash, false,{from:multisig,gasPrice:0});
    var vlcvx = await ICvxLocker.at("0x72a19342e8F1838460eBFCCEf09F6585e32db86E");
    await vlcvx.addReward(fxs.address, vlcvxReceiver.address, true,{from:multisig,gasPrice:0});
    await booster.setPoolFeeDeposit(newFeeDepo.address,{from:multisig,gasPrice:0});
    console.log("msig done");

    await vlcvx.rewardData(fxs.address).then(a=>console.log("reward data fxs: " +JSON.stringify(a) ));


    await fxs.balanceOf(newFeeDepo.address).then(a=>console.log("fxs on fee deposit: " +a))
    await fxs.balanceOf(vlcvx.address).then(a=>console.log("fxs on fee vlcvx: " +a))

    var vault = await StakingProxyConvex.at("0x0D7dC09aFE985a4f0B8001F8E6D754e8D01774Bc");
    await vault.getReward();

    await fxs.balanceOf(newFeeDepo.address).then(a=>console.log("fxs on fee deposit: " +a))
    await fxs.balanceOf(vlcvx.address).then(a=>console.log("fxs on fee vlcvx: " +a))

    await newFeeDepo.distribute({from:deployer});
    console.log("distributed");

    await fxs.balanceOf(newFeeDepo.address).then(a=>console.log("fxs on fee deposit: " +a))
    await fxs.balanceOf(vlcvx.address).then(a=>console.log("fxs on fee vlcvx: " +a))

    await vlcvx.rewardData(fxs.address).then(a=>console.log("reward data fxs: " +JSON.stringify(a) ));
  });
});


