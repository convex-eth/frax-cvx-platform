const { BN, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
var jsonfile = require('jsonfile');
var contractList = jsonfile.readFileSync('./contracts.json');

const Booster = artifacts.require("Booster");
const FxsDepositor = artifacts.require("FxsDepositor");
const FraxVoterProxy = artifacts.require("FraxVoterProxy");
const cvxFxsToken = artifacts.require("cvxFxsToken");
const IFeeDistro = artifacts.require("IFeeDistro");
const StakingProxyERC20 = artifacts.require("StakingProxyERC20");
const IFraxFarmERC20 = artifacts.require("IFraxFarmERC20");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");
const StakingProxyUniV3 = artifacts.require("StakingProxyUniV3");
const TestPool_UniV3 = artifacts.require("TestPool_UniV3");
const TestPool_Erc20 = artifacts.require("TestPool_Erc20");
const ConvexPoolRegistry = artifacts.require("ConvexPoolRegistry");
const StakingProxyConvex = artifacts.require("StakingProxyConvex");
const IFraxFarmERC20_V2 = artifacts.require("IFraxFarmERC20_V2");
const IConvexWrapperV2 = artifacts.require("IConvexWrapperV2");

const INonfungiblePositionManager = artifacts.require("INonfungiblePositionManager");
const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");

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
contract("Vault Tests", async accounts => {
  it("should successfully run", async () => {
    
    let deployer = "0x947B7742C403f20e5FaCcDAc5E092C943E7D0277";
    let multisig = "0xa3C5A1e09150B75ff251c1a7815A07182c3de2FB";
    let addressZero = "0x0000000000000000000000000000000000000000"

    let frax = await IERC20.at(contractList.frax.frax);
    let fxs = await IERC20.at(contractList.frax.fxs);
    let vefxs = await IERC20.at(contractList.frax.vefxs);
    let crv = await IERC20.at(contractList.system.crv);

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

    await unlockAccount(multisig);
    await unlockAccount(deployer);

    let starttime = await time.latest();
    const advanceTime = async (secondsElaspse) => {
      await time.increase(secondsElaspse);
      await time.advanceBlock();
      console.log("\n  >>>>  advance time " +(secondsElaspse/86400) +" days  >>>>\n");
    }
    const day = 86400;

    var actingUser = userA;

    let fxsholder = "0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0";
    await unlockAccount(fxsholder);
    let crvholder = "0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2";
    await unlockAccount(crvholder);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);


    //frax farm
    var stakingAddress = await IFraxFarmERC20_V2.at("0x4c9AD8c53d0a001E7fF08a3E5E26dE6795bEA5ac"); //eusd/fraxbp
    var lptoken = await IERC20.at("0xAEda92e6A3B1028edc139A4ae56Ec881f3064D4F"); //eusd/fraxbp
    var lpHolder = "0x8605dc0C339a2e7e85EEA043bD29d42DA2c6D784"; //eusd/fraxbp
    var stakingToken = await stakingAddress.stakingToken();
    var stakingwrapper = await IConvexWrapperV2.at(stakingToken);
    var distro = await stakingwrapper.distroContract();

    await fxs.transfer(stakingAddress.address,web3.utils.toWei("100000.0", "ether"),{from:fxsholder,gasPrice:0});
    console.log("fxs transfered to farm");
    await crv.transfer(distro,web3.utils.toWei("100000.0", "ether"),{from:crvholder,gasPrice:0});
    console.log("crv transfered to distro");

    await unlockAccount(lpHolder);
    await lptoken.transfer(actingUser,web3.utils.toWei("10000.0", "ether"),{from:lpHolder,gasPrice:0});
    await lptoken.balanceOf(actingUser).then(a=>console.log("lp tokens transfered: " +a) );
    await stakingAddress.sync();
    console.log("farm synced");
    await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));

    //STG/fraxbp
    var stakingAddress = await IFraxFarmERC20_V2.at("0xd600A3E4F57E718A7ad6A0cbb10c2A92c57827e6");
    var lptoken = await IERC20.at("0x9de1c3D446237ab9BaFF74127eb4F303802a2683");
    var lpHolder = "0x8133e6B0B2420bBa10574A6668ea275f5E7Ed253";
    var stakingToken = await stakingAddress.stakingToken();
    var stakingwrapper = await IConvexWrapperV2.at(stakingToken);
    var distro = await stakingwrapper.distroContract();

    await fxs.transfer(stakingAddress.address,web3.utils.toWei("10000.0", "ether"),{from:fxsholder,gasPrice:0});
    console.log("fxs transfered to farm");
    await crv.transfer(distro,web3.utils.toWei("100000.0", "ether"),{from:crvholder,gasPrice:0});
    console.log("crv transfered to distro");

    await unlockAccount(lpHolder);
    await lptoken.transfer(actingUser,web3.utils.toWei("100000.0", "ether"),{from:lpHolder,gasPrice:0});
    await lptoken.balanceOf(actingUser).then(a=>console.log("lp tokens transfered: " +a) );
    await stakingAddress.sync();
    console.log("farm synced");
    await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));


    //uzd/fraxbp
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x7677D1AADcd42dC40E758115FfDE5e1E10B7f30b");
    // let lptoken = await IERC20.at("0x68934F60758243eafAf4D2cFeD27BF8010bede3a");
    // let lpHolder = "0xBdCA4F610e7101Cc172E2135ba025737B99AbD30";

  });
});


