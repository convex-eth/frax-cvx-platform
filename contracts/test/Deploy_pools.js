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
const JointVaultManager = artifacts.require("JointVaultManager");
const StakingProxyERC20Joint = artifacts.require("StakingProxyERC20Joint");

const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");
const IFraxRewardDistributor = artifacts.require("IFraxRewardDistributor");

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

contract("Deploy Pool(s)", async accounts => {
  it("should successfully run", async () => {
    
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

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    var booster = await Booster.at(contractList.system.booster);
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.at(contractList.system.poolRegistry);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);
    let feeDepo = await FeeDeposit.at(contractList.system.feeDeposit);
    let rewardMaster = await MultiRewards.at(contractList.system.rewardImplementation);

    // await unlockAccount(deployer);
    var deployedData = [];

    const deployConvexPool = async (stakingAddress, targetname) => {
      var imp = contractList.system.vaultConvexImplementation;
      console.log("\n----- Deploy Convex Pool ------\n");
      console.log("farm for: " +targetname);
      console.log("imp: " +imp);
      //get staking farm instance
      var farm = await IFraxFarmERC20.at(stakingAddress);
      console.log("staking address: " +farm.address);

      //get stakingToken
      var stakingToken = await farm.stakingToken();
      var wrappertoken = await ERC20.at(stakingToken);
      var wrapper = await IConvexWrapper.at(stakingToken);
      console.log("wrapper at: " +wrapper.address);
      await wrappertoken.name().then(a=>console.log("token name: " +a))


      //get current vault
      var currentVault = await wrapper.collateralVault();
      console.log("current vault: " +currentVault);

      //if vault is 0
      //set vault back to staking address
      // if(currentVault == addressZero){
      //   await wrapper.setVault(stakingAddress,{from:deployer});
      //   currentVault = await wrapper.collateralVault();
      //   console.log("set vault: " +currentVault);
      //   assert(currentVault == farm.address, "vault doesnt match")
      // }

      //TODO: check that distro has been made

      //assert proxy
      var proxy = await farm.getProxyFor(contractList.system.voteProxy);
      console.log("proxy check: " +proxy);
      // assert(proxy == voteproxy.address, "proxy not set yet!");

      //add pool
      await booster.addPool(imp, farm.address, stakingToken, {from:deployer});

      var poolLength = await poolReg.poolLength();
      console.log("pool added: " +(poolLength-1) );

      var poolinfo = await poolReg.poolInfo(poolLength-1);
      console.log("pool info: " +JSON.stringify(poolinfo));

      deployedData.push({
        id: poolLength-1,
        implementation: imp,
        stakingAddress: farm.address,
        stakingToken: stakingToken,
        rewardsAddress: poolinfo.rewardsAddress,
        name: targetname
      })
    }

    const deployERC20Pool = async (stakingAddress, targetname) => {
      var imp = contractList.system.vaultErc20Implementation;
      console.log("\n----- Deploy ERC20 Pool ------\n");
      console.log("farm for: " +targetname);
      console.log("imp: " +imp);
      //get staking farm instance
      var farm = await IFraxFarmERC20.at(stakingAddress);
      console.log("staking address: " +farm.address);

      //get stakingToken
      var stakingToken = await farm.stakingToken();
      var wrappertoken = await ERC20.at(stakingToken);
      await wrappertoken.name().then(a=>console.log("token name: " +a))

      //assert proxy
      var proxy = await farm.getProxyFor(contractList.system.voteProxy);
      console.log("proxy check: " +proxy);
      // assert(proxy == voteproxy.address, "proxy not set yet!");

      //add pool
      await booster.addPool(imp, farm.address, stakingToken, {from:deployer});

      var poolLength = await poolReg.poolLength();
      console.log("pool added: " +(poolLength-1) );

      var poolinfo = await poolReg.poolInfo(poolLength-1);
      console.log("pool info: " +JSON.stringify(poolinfo));

      deployedData.push({
        id: poolLength-1,
        implementation: imp,
        stakingAddress: farm.address,
        stakingToken: stakingToken,
        rewardsAddress: poolinfo.rewardsAddress,
        name: targetname
      })
    }

    const shutdownPool = async (poolId) => {
      console.log("\n\nShutdown pool " +poolId +"\n");
      var poolinfo = await poolReg.poolInfo(poolId);
      var wrappertoken = await ERC20.at(poolinfo.stakingToken);
      console.log("---- pre -----");
      console.log(JSON.stringify(poolinfo));
      await wrappertoken.name().then(a=>console.log("token name: " +a))


      await booster.deactivatePool(poolId,{from:deployer});


      var poolinfo = await poolReg.poolInfo(poolId);
      console.log("---- post -----");
      console.log(JSON.stringify(poolinfo));
      await wrappertoken.name().then(a=>console.log("token name: " +a))

    }
    // await deployConvexPool("0xd1f21322bBDd3586dC1151ADCcaA2684641c2b31","Convex ageur/FraxBP");
    // await deployConvexPool("0xA0657642224Fc53dAB4a3d2069430afe157BEc5D","Convex alcx/FraxBP");
    // await deployConvexPool("0xeC670c5e0A8A8d5ae5639158565D840DE44CA03f","Convex CVX/FraxBP");
    // await deployConvexPool("0x57c9F019B25AaAF822926f4Cacf0a860f61eDd8D","Convex cvxCrv/FraxBP");
    // await deployConvexPool("0x2F9504988675c91787E188Ed928D6E042d9052e9","Convex cvxFxs/FraxBP");
    // await deployConvexPool("0xE7211E87D60177575846936F2123b5FA6f0ce8Ab","Convex dola/FraxBP");
    // await deployConvexPool("0xdE5684F85a78F6CcCFFB4b9301ad0944eb5CE3eE","Convex mai/FraxBP");
    // await deployConvexPool("0x40b42E4ab3c044e67CBFb0bD99C9E975dcB83668","Convex pusd/FraxBP");


    // await deployConvexPool("0x5a92EF27f4baA7C766aee6d751f754EBdEBd9fae", "Convex Badger/FraxBP");
    // await deployConvexPool("0xa537d64881b84faffb9Ae43c951EEbF368b71cdA", "Convex FrxEth/Eth");
    // await deployConvexPool("0xF22D3C85e41Ef4b5Ac8Cb8B89a14718e290a0561", "Convex RSR/FraxBP");
    // await deployConvexPool("0x4edF7C64dAD8c256f6843AcFe56876024b54A1b6", "Convex XAI/FraxBP");
    // await deployERC20Pool("0x73e1e624C6d3E027b8674e6C72F104F1429FC17E", "Fraxlend FRAX/FXS");

    // await deployConvexPool("0x9C8d9667d5726aEcA4d24171958BeE9F46861bed", "Convex SDT/FraxBP");
    // await deployConvexPool("0x5745506D56b0088f800085b1227B3f1F7d419c89", "Convex clevUSD/FraxBP");
    // await deployConvexPool("0xfB2CCc82755A734C53C8B45f260fFc2df026fe87", "Convex msUSD/FraxBP");
    // await deployConvexPool("0xc96e1a26264D965078bd01eaceB129A65C09FFE7", "Convex OHM/FraxBP");


    await deployConvexPool("0x4c9AD8c53d0a001E7fF08a3E5E26dE6795bEA5ac", "Convex eUSD/FraxBP");
    await deployConvexPool("0xd600A3E4F57E718A7ad6A0cbb10c2A92c57827e6", "Convex STG/FraxBP");

    console.log("data:");
    console.log(JSON.stringify(deployedData, null, 4));
    console.log("done");
  });
});


