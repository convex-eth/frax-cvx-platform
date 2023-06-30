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
const IFraxFarmERC20_V2 = artifacts.require("IFraxFarmERC20_V2");
const PoolRegistry = artifacts.require("PoolRegistry");
const FeeRegistry = artifacts.require("FeeRegistry");
const MultiRewards = artifacts.require("MultiRewards");
const PoolUtilities = artifacts.require("PoolUtilities");
const IConvexWrapperV2 = artifacts.require("IConvexWrapperV2");
const ICvxLocker = artifacts.require("ICvxLocker");
const FeeDeposit = artifacts.require("FeeDeposit");
const GaugeExtraRewardDistributor = artifacts.require("GaugeExtraRewardDistributor");
const IConvexWrapperFactory = artifacts.require("IConvexWrapperFactory");

const IVPool = artifacts.require("IVPool");
const IExchange = artifacts.require("IExchange");
const IERC20 = artifacts.require("IERC20");
const ERC20 = artifacts.require("ERC20");

const IFraxGaugeController = artifacts.require("IFraxGaugeController");
const IFraxRewardDistributor = artifacts.require("IFraxRewardDistributor");
const IFraxFarmFactory = artifacts.require("IFraxFarmFactory");

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

    const getTimestampInSeconds = async () => {
      // return Math.floor(Date.now() / 1000)
      var t = await time.latest()
      return Number(t);
    }
    await getTimestampInSeconds().then(a=>console.log("time: " +a))
    // console.log("time: " +getTimestampInSeconds());

    await unlockAccount(deployer);
    await unlockAccount(multisig);

    let voteproxy = await FraxVoterProxy.at(contractList.system.voteProxy);
    var booster = await Booster.at(contractList.system.booster);
    var curvebooster = await ICurveConvex.at("0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
    let controller = await IFraxGaugeController.at(contractList.frax.gaugeController);

    let feeReg = await FeeRegistry.at(contractList.system.feeRegistry);
    let poolReg = await PoolRegistry.at(contractList.system.poolRegistry);
    let poolUtil = await PoolUtilities.at(contractList.system.poolUtility);
    let feeDepo = await FeeDeposit.at(contractList.system.feeDeposit);
    let rewardMaster = await MultiRewards.at(contractList.system.rewardImplementation);

    let actingUser = userA
    await unlockAccount(actingUser);
    console.log("acting user: " +actingUser);





     //frax farm
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x4c9AD8c53d0a001E7fF08a3E5E26dE6795bEA5ac"); //eusd/fraxbp
    // let lptoken = await IERC20.at("0xAEda92e6A3B1028edc139A4ae56Ec881f3064D4F"); //eusd/fraxbp
    // let lpHolder = "0x8605dc0C339a2e7e85EEA043bD29d42DA2c6D784"; //eusd/fraxbp

    //STG/fraxbp
    // let stakingAddress = await IFraxFarmERC20_V2.at("0xd600A3E4F57E718A7ad6A0cbb10c2A92c57827e6");
    // let lptoken = await IERC20.at("0x9de1c3D446237ab9BaFF74127eb4F303802a2683");
    // let lpHolder = "0x8133e6B0B2420bBa10574A6668ea275f5E7Ed253";

    //uzd/fraxbp
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x7677D1AADcd42dC40E758115FfDE5e1E10B7f30b");
    // let lptoken = await IERC20.at("0x68934F60758243eafAf4D2cFeD27BF8010bede3a");
    // let lpHolder = "0xBdCA4F610e7101Cc172E2135ba025737B99AbD30";
    // let convexPoolId = 158;

    //frax usdp
    // let lptoken = await IERC20.at("0xFC2838a17D8e8B1D5456E0a351B0708a09211147");
    // let lpHolder = "0xfb860600F1bE1f1c72A89B2eF5CAF345aff7D39d";
    // let convexPoolId = 169;
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x2A5b8C7DFE489CeB00ec80524C0bA0C1b78433A9");

    //frax crvusd
    // let lptoken = await IERC20.at("0x0CD6f267b2086bea681E922E19D40512511BE538");
    // let lpHolder = "0x96424E6b5eaafe0c3B36CA82068d574D44BE4e3c";
    // let convexPoolId = 187;
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x67CC47cF82785728DD5E3AE9900873a074328658");

    //sweth/frxeth
    // let lptoken = await IERC20.at("0xe49AdDc2D1A131c6b8145F0EBa1C946B7198e0BA");
    // let lpHolder = "0xE6A9fd148Ad624a5A8700c6366e23E3cD308DFcB";
    // let convexPoolId = 186;
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x7b8848f10A016341c9B2427e8541C19F31C2D243");


    //crv/frxeth
    // let lptoken = await IERC20.at("0xc34993c9aDf6a5AB3b4cA27dC71b9c7894A53974");
    // let lpHolder = "0x266cE172a1180134cf6C7836C516bd6A58b1f619";
    // let convexPoolId = 162;
    // let stakingAddress = await IFraxFarmERC20_V2.at("0xDA0622cBa8cC821ee0d4AfA366Df95E948b43297");

    //ZUSD/FraxBP
    let lptoken = await IERC20.at("0x400d4C984779A747462e88373c3fE369EF9F5b50");
    let lpHolder = "0xAff9104E58D0123632F392d16b2a6E0db79c1363";
    let convexPoolId = 196;
    let stakingAddress = await IFraxFarmERC20_V2.at("0x107a33019910E57533Ad4F75762d6A958630cA3d");

    let convexwrapperfactory = await IConvexWrapperFactory.at(contractList.system.fraxWrapperFactory);
    let wrapperowner = await convexwrapperfactory.owner();
    await unlockAccount(wrapperowner);
    console.log("wrapper fractory owner: " +wrapperowner);

    ///A ----- create from factory

    //update wrapper to latest
    // let wrapperimpl = "0x5Bb5BCcf21fb0fb985FA8F9A7AAAa1E1bD6d7AB6";//await ConvexStakingWrapperFrax.new({from:deployer});
    // // let wrapperimpl = await ConvexStakingWrapperFrax.new({from:deployer});
    // await convexwrapperfactory.setImplementation(wrapperimpl,{from:wrapperowner});
    // console.log("updated wrapper implementation");


    // let wrapperaddress = await convexwrapperfactory.CreateWrapper.call(convexPoolId,{from:wrapperowner,gasPrice:0});
    // await convexwrapperfactory.CreateWrapper(convexPoolId,{from:wrapperowner,gasPrice:0});
    // console.log("created convex wrapper at: " +wrapperaddress);

    // let fraxfarmfactory = await IFraxFarmFactory.at("0x5dff3d062bEC839a20029F19edCa90eD981b2c0e");

    // let farmowner = deployer;
    // let rewardTokens = [fxs.address,crv.address,cvx.address];
    // let rewardManagers = [deployer,deployer,deployer];
    // let rewardRates = [10000,0,0];
    // let gaugeController = [addressZero,addressZero,addressZero];
    // let rewardDistros = ["0x278dC748edA1d8eFEf1aDFB518542612b49Fcd34", addressZero, addressZero];
    // let farmtoken = wrapperaddress;

    // let farmaddress = await fraxfarmfactory.createFXBPStableFarm.call(farmowner,rewardTokens, rewardManagers, rewardRates, gaugeController, rewardDistros, farmtoken ,{from:deployer});
    // console.log("farmaddress: " +farmaddress);
    // await fraxfarmfactory.createFXBPStableFarm(farmowner,rewardTokens, rewardManagers, rewardRates, gaugeController, rewardDistros, farmtoken ,{from:deployer});
    // console.log("farm created");
    // let stakingAddress = await IFraxFarmERC20_V2.at(farmaddress);

    //B ---- test deployed farm


    // let stakingAddress = await IFraxFarmERC20_V2.at("0x2A5b8C7DFE489CeB00ec80524C0bA0C1b78433A9");
    // let stakingAddress = await IFraxFarmERC20_V2.at("0x67CC47cF82785728DD5E3AE9900873a074328658");


    /////////////////////////////////////////////////////

    let AddToGauge = false;
    let CallSetVault = false;
    let CallSetDistroManagers = false;
    let PullLpTokenCount = "20.0";
    let LpTokenCount = "10.0";

    let tokenaddy = await stakingAddress.stakingToken();
    let stakingToken = await IERC20.at(tokenaddy);
    let stakingwrapper = await IConvexWrapperV2.at(stakingToken.address);
   

    console.log("\n----- Starting Tests ------\n");
    console.log("staking address: " +stakingAddress.address);

    //get stakingToken
    var wrappertoken = await ERC20.at(tokenaddy);
    console.log("wrapper at: " +stakingwrapper.address);
    await wrappertoken.name().then(a=>console.log("token name: " +a))
    console.log("\n\n");
    
    //get tokens
    await unlockAccount(lpHolder);
    await lptoken.transfer(actingUser,web3.utils.toWei(PullLpTokenCount, "ether"),{from:lpHolder,gasPrice:0});
    console.log("lp tokens transfered");


    await stakingAddress.sync().catch(a=>console.log("sync fail: " +a));

    let fxsholder = "0xc8418aF6358FFddA74e09Ca9CC3Fe03Ca6aDC5b0";
    await unlockAccount(fxsholder);
    await fxs.transfer(stakingAddress.address,web3.utils.toWei("100000.0", "ether"),{from:fxsholder,gasPrice:0});
    console.log("fxs transfered to farm");
    

    //setup distro and manager
    if(CallSetVault){
      await stakingwrapper.setVault(stakingAddress.address,{from:wrapperowner});
    }else{
      console.log("\n***** wrapper setVault already called\n")
    }

    var distro = await stakingwrapper.distroContract();
    console.log("set vault, distro: " +distro)
    if (distro == addressZero){
      console.log("\n !!!!! distro 0x0, setVault not called !!!!");
      return;
    }

    //temp: set valid proxy
    var stakingOwner = await stakingAddress.owner();
    await unlockAccount(stakingOwner);
    var currentProxy = await stakingAddress.getProxyFor(contractList.system.voteProxy);
    if(currentProxy == addressZero){
      console.log("forcing vefxs proxy toggle...");
      await stakingAddress.toggleValidVeFXSProxy(contractList.system.voteProxy,{from:stakingOwner,gasPrice:0});
    }else{
      console.log("\n*** proxy already correctly set ***\n")
    }
    await stakingAddress.getProxyFor(contractList.system.voteProxy).then(a=>console.log("Proxy check: " +a));


    // let impl = await StakingProxyConvex.new();
    let impl = await StakingProxyConvex.at(contractList.system.vaultConvexImplementation);

    var poolcount = await poolReg.poolLength();
    console.log("pool count: " +poolcount);

    var tx = await booster.addPool(impl.address, stakingAddress.address, stakingToken.address,{from:deployer,gasPrice:0});
    console.log("pool added, gas: " +tx.receipt.gasUsed);
    await poolReg.poolLength().then(a=>console.log("new pool count: " +a));

    var poolinfo = await poolReg.poolInfo(poolcount);
    console.log(poolinfo);
    
    //create vault
    var tx = await booster.createVault(poolcount,{from:actingUser});
    
    //get vault
    let vaultAddress = await poolReg.vaultMap(poolcount,actingUser);
    let vault = await StakingProxyConvex.at(vaultAddress)
    console.log("vault at " +vault.address);// +", gas: " +tx.receipt.gasUsed);


    var tokenBalance = await lptoken.balanceOf(actingUser);
    console.log("tokenBalance: " +tokenBalance);

    var lockDuration = day*7;

    //stake
    await lptoken.approve(vault.address, web3.utils.toWei("1000000000.0","ether"),{from:actingUser});
    var tx = await vault.stakeLockedCurveLp(web3.utils.toWei(LpTokenCount,"ether"), lockDuration, {from:actingUser});
    console.log("staked, gas: " +tx.receipt.gasUsed);

    var stakeInfo = await stakingAddress.lockedStakesOf(vault.address);
    console.log("stake info: " +stakeInfo);
    console.log("kek id: " +stakeInfo[0][0]);
    console.log("stake info: " +JSON.stringify(stakeInfo));
    await stakingAddress.userStakedFrax(vault.address).then(a=>console.log("userStakedFrax: " +a));
    await stakingAddress.getAllRewardTokens().then(a=>console.log("getAllRewardTokens: " +a))
    await stakingAddress.lockedLiquidityOf(vault.address).then(a=>console.log("lockedLiquidityOf: " +a))
    await stakingAddress.combinedWeightOf(vault.address).then(a=>console.log("combinedWeightOf: " +a))
    await stakingAddress.veFXSMultiplier(vault.address).then(a=>console.log("veFXSMultiplier: " +a))

    await poolUtil.weightedRewardRates(stakingAddress.address).then(a=>console.log("pool util -> weightedRewardRates: " +a));
    await poolUtil.userBoostedRewardRates(stakingAddress.address, vault.address).then(a=>console.log("pool util -> userBoostedRewardRates: " +a));
    await poolUtil.veFXSMultiplier(stakingAddress.address).then(a=>console.log("pool util -> veFXSMultiplier: " +a));


    console.log("\n\n\n >>>> Withdraw >>> \n");
    
    //withdraw
    await advanceTime(lockDuration*2 + day);


    await stakingToken.balanceOf(actingUser).then(a=>console.log("staking token actingUser: " +a));
    await lptoken.balanceOf(actingUser).then(a=>console.log("lp token actingUser: " +a));
    // await vault.withdrawLocked(stakeInfo[0][0],{from:actingUser});
    await vault.withdrawLockedAndUnwrap(stakeInfo[0][0],{from:actingUser});
    console.log("-> withdrawn");
    await stakingToken.balanceOf(actingUser).then(a=>console.log("staking token actingUser: " +a));
    await lptoken.balanceOf(actingUser).then(a=>console.log("lp token actingUser: " +a));
    await stakingToken.balanceOf(vault.address).then(a=>console.log("staking token vault: " +a));
    await lptoken.balanceOf(vault.address).then(a=>console.log("lp token vault: " +a));

    await vault.earned.call().then(a=>console.log("vault earned: " +JSON.stringify(a) ));
    await fxs.balanceOf(actingUser).then(a=>console.log("user A fxs: " +a));
    await crv.balanceOf(actingUser).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(actingUser).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    await fxs.balanceOf(feeDepo.address).then(a=>console.log("feeDepo fxs: " +a));
    await vault.getReward();
    console.log("-> vault get reward");
    await fxs.balanceOf(actingUser).then(a=>console.log("user A fxs: " +a));
    await crv.balanceOf(actingUser).then(a=>console.log("user A crv: " +a));
    await cvx.balanceOf(actingUser).then(a=>console.log("user A cvx: " +a));
    await crv.balanceOf(vault.address).then(a=>console.log("vault crv: " +a));
    await cvx.balanceOf(vault.address).then(a=>console.log("vault cvx: " +a));
    await fxs.balanceOf(feeDepo.address).then(a=>console.log("feeDepo fxs: " +a));
  });
});


