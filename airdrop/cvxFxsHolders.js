const fs = require('fs');
const { ethers } = require("ethers");
const jsonfile = require('jsonfile');
const { CRV_ABI, MASTERCHEF_ABI, UNITVAULT_ABI, MULTICALL_ABI, REWARDS_ABI, MASTERCHEFVTWO_ABI, GAUGE_ABI } = require('./abi');
var BN = require('big-number');

const config = jsonfile.readFileSync('./config.json');

const cvxfxsholders_file = 'cvxfxs_holders.json';
const cvxfxsfinal_file = 'cvxfxs_final.json';


//Setup ethers providers
// const provider = new ethers.providers.InfuraProvider(config.NETWORK, config.INFURA_KEY);
const provider = new ethers.providers.AlchemyProvider (config.NETWORK, config.ALCHEMY_KEY);
//const provider = new ethers.providers.JsonRpcProvider(config.GETH_NODE, config.NETWORK);

const voteProxy = "0x989AEb4d175e16225E39E87d0D97A3360524AD80";

const cvxfxsAddress = '0xFEEf77d3f69374f66429C91d732A244f074bdf74';
const stkcvxfxsAddress = '0x49b4d1dF40442f0C31b1BbAEA3EDE7c38e37E31a';



const multicallContract = new ethers.Contract("0x5e227AD1969Ea493B43F840cfF78d08a6fc17796", MULTICALL_ABI, provider);
const multicallInstance = multicallContract.connect(provider);


//Load any previous work
if (fs.existsSync(cvxfxsholders_file)) {
    cvxfxsHolders = jsonfile.readFileSync(cvxfxsholders_file);
} else {
    cvxfxsHolders = {
        addresses: {}
    };
}

var redirects = {
    "0xc9a91b44C49A18Cd167cdC74FEBf5dc3f8CfcF5B":"0xC4Dd018f8c281BD4A7DF9777546d1c0fdE3826F9", //inverse user
    "0x92D863279f6047f21615D453E725d30110E2A260":"0xeBe2Eb875eCCfb50A99675420f58174ddF564Cf7", //inverse user
    "0x40878C36DcEdd48a236894893739b4e0Ddd6684C":"0xdD84Ce1aDcb3A4908Db61A1dFA3353C3974c5a2B", //inverse user
    "0xE873174F2988c4C1eEE3D820b30F1f8cD24cA220":"0xAAc0aa431c237C2C0B5f041c8e59B3f1a43aC78F", //inverse user
    "0x5070aE2d302d04441186A39448505B3ACd562a2a":"0x8061199A31983A077E691C08B2263a4CF5c24093", //inverse user
    "0x8c34a491A534408249f2904E751571FA4C49F358":"0x1E0cABeF79e70DDaca8859e9A33b306DE1a368f9", //inverse user
    "0xAc53f7B0Bb07287a30002FC702831C6b42e1dBfb":"0x85F4b16f064d45aacAC017D420d3091A80155D6E", //inverse user
    "0x434A83971aeCaeeF430b51FC76A2307e786eF926":"0x9445e93057F3f5e3452Ce50fC867b22a48B4d82A", //inverse user
    "0x15BA375645f4EBb7e11cb3cae8b53e7c4695F52a":"0xED9376094Ce37635827E0Cfddc23bFbb6D788469", //inverse user
    "0x437ae349875a3e225A72Bd4A3a5c1E60904adF94":"0xe32a8CF93AF8661Ec4708ef627b255801184ad2f", //inverse user
    "0x3c490DDAebD9F2C0127D5339F8461998423ac9d2":"0xE4295A6625737cAFfe89C3aeAfD8E93b734D53a6", //inverse user
    "0x55576A344c7A8F15ff820C52F23dDa188443dCBD":"0x961Eed3b7d4B7c261EE5B023E5F857af5aF1E700", //inverse user
}



function compare( a, b ) {
  return b.num._compare(a.num);
}

function combine(a,b){
    //combine
    var combined = {};
    for (var i in a) {
        combined[i] = a[i];
    }
    for (var i in b) {
        if(combined[i] == undefined){
            combined[i] = b[i];
        }else{
            //add
            var increase = new BN(b[i]);
            var final = new BN(combined[i]).add(increase);
            combined[i] = final.toString();
        }
    }
    return combined;
}

function formatToDecimals(data) {
    var arr = []
    for (var i in data) {
        arr.push({address:i,num:new BN(data[i])})
    }
    var formatted = {};
    for(var i in arr){
        var amount = arr[i].num.toString()

        amount = amount.padStart(19,"0");
        amount = [Number(amount.substring(0,amount.length-18)).toLocaleString(), ".", amount.substring(amount.length-18)].join('');
        amount = amount.replace(/(\.[0-9]*[1-9])0+$|\.0*$/,'$1')

        formatted[arr[i].address] = amount
    }
    return formatted;
}

function formatRemoveDecimals(data) {
    var formatted = {};
    for (var i in data) {
        var numstr = data[i].replace(",","");
        var decimals = numstr.substring(numstr.indexOf(".")).padEnd(19,"0").substring(1);
        numstr = numstr.substring(0,numstr.indexOf(".")).replace(/^0+/, '');
        formatted[i] = numstr+decimals;
    }
    return formatted;
}

const getBalances = async (token, userAddresses, snapshotBlock) => {
    let querySize = 30;
    let iface = new ethers.utils.Interface(CRV_ABI)
    var balances = {};

    var addressArray = [];
    for (var i in userAddresses) {
        addressArray.push(i);
    }
   // console.log(addressArray);
    console.log("address length: " +addressArray.length);
    var groups = Number( (addressArray.length/querySize) + 1).toFixed(0);
    console.log("address groups: " +groups);
    await Promise.all([...Array(Number(groups)).keys()].map(async i => {
        var start = i*querySize;
        var finish = i*querySize + querySize - 1;
        if(finish >= addressArray.length){
            finish = addressArray.length - 1;
        }
        console.log("get balances from " + start + " to " +finish);
        var calldata = [];
        var addresses = [];
        for(var c = start; c <= finish; c++){
            // console.log("queuery for " +addressArray[c]);
            var enc = iface.encodeFunctionData("balanceOf(address)",[addressArray[c]]);
            calldata.push([token,enc]);
            addresses.push(addressArray[c]);
        }
        //console.log(calldata);
        let returnData = await multicallInstance.aggregate(calldata, { blockTag: snapshotBlock });
        var balData = returnData[1];
        //console.log(returnData);
        for(var d = 0; d < balData.length; d++){
            // if(balData[d] == "0x")continue;
            // console.log("baldata[d]: " +balData[d]);
            var bal = ethers.BigNumber.from(balData[d]);
            if(bal > 0){
                balances[addresses[d]] = bal.toString();
            }
        }
    }));
    return balances; 
}

const getPoolHolders = async (snapshotBlock, startBlock, lpaddress, pooladdress, gauge, rewardAddress) => {
    console.log("Getting lp holders");
    var logCount = 15000;
    var holders = {};

    var contract = new ethers.Contract(lpaddress, CRV_ABI, provider);
    var instance = contract.connect(provider);

    //get holders
    for (var i = startBlock; i <= snapshotBlock;) {
        var logs = await instance.queryFilter(instance.filters.Transfer(), i, i + logCount)
        var progress = ((i - startBlock) / (snapshotBlock - startBlock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var pool = logs[x].args[1].toString();

            if(to == gauge) continue;
            if(to == "0x0000000000000000000000000000000000000000") continue;

            //log("cvxfxs transfor to: " +to);
            holders[to] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }

    var contract = new ethers.Contract(rewardAddress, REWARDS_ABI, provider);
    var instance = contract.connect(provider);
    //get stakers. cant look at transfer since you can use stakeFor()
    for (var i = startBlock; i <= snapshotBlock;) {
        var logs = await instance.queryFilter(instance.filters.Staked(), i, i + logCount)
        var progress = ((i - startBlock) / (snapshotBlock - startBlock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];

            holders[from] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }

    console.log("getting vanilla lp balances...");
    var plain = await getBalances(lpaddress,holders,snapshotBlock );
    console.log("getting staked lp balances...");
    var stakers = await getBalances(rewardAddress,holders,snapshotBlock );

    holders = combine(plain,stakers);
    // console.log("cnt: " +Object.keys(holders).length);
    
    var totallp = new BN(0);
    for (var i in holders) {
        var lpbalance = new BN(holders[i]);
        totallp = totallp.add(lpbalance);
    }
    console.log("lp token total: " +totallp.toString());
    
    const cvxFxsContract = new ethers.Contract(cvxfxsAddress, CRV_ABI, provider);

    //get amount of cvxfxs on lp
    var lpcvxfxs = await cvxFxsContract.balanceOf(pooladdress, { blockTag: snapshotBlock });
    console.log("cvxfxs on lp: "+lpcvxfxs.toString())
   
    //convert
    var convertratio = new BN(lpcvxfxs.toString()).multiply(1e18).div(totallp);
    console.log("convertratio: " +convertratio.toString())

    var balanceCheck = BN(0);
    for (var i in holders) {
        var cvxfxsbalance = new BN(convertratio).multiply(new BN(holders[i])).div(1e18);
        balanceCheck.add(cvxfxsbalance);
        holders[i] = cvxfxsbalance.toString();
    }
    console.log("final cvxfxs balance for all LPers (should be close to balanceOf above (rounding)): " +balanceCheck.toString());

    return holders;
}



const getcvxFxsHolders = async (snapshotBlock) => {
	console.log("Getting cvxFxs holders");
    const cvxFxsContract = new ethers.Contract(cvxfxsAddress, CRV_ABI, provider);
    const cvxFxsInstance = cvxFxsContract.connect(provider);
    var logCount = 15000;
    var startBlock = 13854115;
    var holders = {};
    //get holders
    for (var i = startBlock; i <= snapshotBlock;) {
        var logs = await cvxFxsInstance.queryFilter(cvxFxsInstance.filters.Transfer(), i, i + logCount)
        var progress = ((i - startBlock) / (snapshotBlock - startBlock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
        	//log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var pool = logs[x].args[1].toString();

            // if(to == stakeAddress) continue;
            if(to == "0x0000000000000000000000000000000000000000") continue;

            //log("cvxfxs transfor to: " +to);
            holders[to] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }
    
    delete holders["0x0000000000000000000000000000000000000000"];

    holders = await getBalances(cvxfxsAddress,holders,snapshotBlock );
    return holders;
}

const getcvxFxsStakers = async (snapshotBlock) => {
    console.log("Getting cvxFxs stakers");
    var cvxFxsContract = new ethers.Contract(stkcvxfxsAddress, CRV_ABI, provider);
    var instance = cvxFxsContract.connect(provider);
    var logCount = 15000;
    var startBlock = 16780566;
    var holders = {};
    //get holders
    for (var i = startBlock; i <= snapshotBlock;) {
        var logs = await instance.queryFilter(instance.filters.Transfer(), i, i + logCount)
        var progress = ((i - startBlock) / (snapshotBlock - startBlock)) * 100;
        console.log('Current Block: ' + i + ' Progress: ' + progress.toFixed(2) + '%');
        for (var x = 0; x < logs.length; x++) {
            //log("log: " +JSON.stringify(logs[x].args));
            var from = logs[x].args[0];
            var to = logs[x].args[1];
            var pool = logs[x].args[1].toString();

            // if(to == stakeAddress) continue;
            if(to == "0x0000000000000000000000000000000000000000") continue;

            // console.log("cvxfxs transfor to: " +to);
            holders[to] = "0";
        }
        if (i==snapshotBlock) {
            break;
        }
        i = i + logCount;
        if (i > snapshotBlock) {
            i = snapshotBlock;
        }
    }
    
    delete holders["0x0000000000000000000000000000000000000000"];
    holders = await getBalances(stkcvxfxsAddress,holders,snapshotBlock );
    return holders;
}


const main = async () => {
    // var snapshotBlock = await provider.getBlockNumber();
    // var snapshotBlock = 14246086; //fpi drop
    var snapshotBlock = 19379573; //fxtl 1 drop
    console.log('snapshotBlock block:' + snapshotBlock)

 	//// cvxfxs holders/stakers
 	var holders = await getcvxFxsHolders(snapshotBlock);
    var stakers = await getcvxFxsStakers(snapshotBlock);

    //startblock, lptoken, gauge, convex reward
    var lpers1 = await getPoolHolders(snapshotBlock,17532777,"0x6a9014FB802dCC5efE3b97Fd40aAa632585636D0","0x6a9014FB802dCC5efE3b97Fd40aAa632585636D0","0x0c58c509305a8a7fE9a6a60CEaAC6185B96ECBb7","0x19F3C877eA278e61fE1304770dbE5D78521792D2");
    var lpers2 = await getPoolHolders(snapshotBlock,14249398,"0xf3a43307dcafa93275993862aae628fcb50dc768","0xd658a338613198204dca1143ac3f01a722b5d94a","0xab1927160ec7414c6fa71763e2a9f3d107c126dd","0xf27AFAD0142393e4b3E5510aBc5fe3743Ad669Cb");
    var lpers3 = await getPoolHolders(snapshotBlock,15465253,"0xf57ccad8122b898a147cc8601b1eca88b1662c7e","0x21d158d95c2e150e144c36fc64e3653b8d6c6267","0xc7a770de69479beeeef22b2c9851760bac3630da","0x19eA715F854dB2196C6f45A174541a5Ac884D2f9");
 
    var lpers = combine(combine(lpers1,lpers2),lpers3);

    var holdersstakers = combine(holders,stakers);
    cvxfxsHolders.addresses = combine(holdersstakers,lpers);
    delete cvxfxsHolders.addresses["0x6a9014FB802dCC5efE3b97Fd40aAa632585636D0"]; //lp 1
    delete cvxfxsHolders.addresses["0xd658A338613198204DCa1143Ac3F01A722b5d94A"]; //lp 2
    delete cvxfxsHolders.addresses["0x21d158d95c2e150e144c36fc64e3653b8d6c6267"]; //lp 3
    delete cvxfxsHolders.addresses["0x49b4d1dF40442f0C31b1BbAEA3EDE7c38e37E31a"]; //staked cvxfxs
    delete cvxfxsHolders.addresses["0x34C0bD5877A5Ee7099D0f5688D65F4bB9158BDE2"]; //fraxtal bridge

    var totalHeldcvxfxs = BN(0);
    for (var i in cvxfxsHolders.addresses) {
        totalHeldcvxfxs.add(new BN(cvxfxsHolders.addresses[i]));
    }
    console.log("total held: " +totalHeldcvxfxs.toString());

    //redirects
    var rkeys = Object.keys(redirects);
    console.log("redirects...");
    for(var i=0; i < rkeys.length; i++){
        var from = rkeys[i];
        var to = redirects[from];
        if(cvxfxsHolders.addresses[from] != undefined){
            console.log("redirect from " +from +"  to  " +to +" amount: "+cvxfxsHolders.addresses[from]);
            if(cvxfxsHolders.addresses[to] == undefined){
                cvxfxsHolders.addresses[to] = cvxfxsHolders.addresses[from];
            }else{
                //add
                var balance = new BN(cvxfxsHolders.addresses[to]).add(new BN(cvxfxsHolders.addresses[from]));
                cvxfxsHolders.addresses[to] = balance.toString();
            }
        }else{
            console.log(from +" does not have cvxfxs");
        }
        //remove old
        delete cvxfxsHolders.addresses[from];
    }


    ////// **** begin external vaults etc from other protocols **** //////

    //Currently adding in user info given to us by each protocol's team
    //In the future this could be nice to calculate via this script but for now
    //just importing a json file

    //airforce
    var airforce = jsonfile.readFileSync('./airforce_cvxfxs_1.json');
    var airTotal = BN(0);
    for (var i in airforce) {
        airTotal.add(new BN(airforce[i]));
    }
    console.log("airforce total: " +airTotal.toString());
    delete cvxfxsHolders.addresses["0x110A888f88b65a2c34a6922f518128eDa4FB70de"]; //airforce vault
    cvxfxsHolders.addresses = combine(cvxfxsHolders.addresses,airforce);

    //afxs
    var afxs = jsonfile.readFileSync('./afxs_cvxfxs_1.json');
    afxs = formatRemoveDecimals(afxs);
    var afxsTotal = BN(0);
    for (var i in afxs) {
        afxsTotal.add(new BN(afxs[i]));
    }
    console.log("afxs total: " +afxsTotal.toString());
    delete cvxfxsHolders.addresses["0x36925622dc537c65cd6433703f7aEdA5929b1CBf"]; //afxs vault
    cvxfxsHolders.addresses = combine(cvxfxsHolders.addresses,afxs);

    ////// **** end external vaults etc from other protocols **** //////
    
    var totalcvxfxs = BN(0);
    for (var i in cvxfxsHolders.addresses) {
        totalcvxfxs.add(new BN(cvxfxsHolders.addresses[i]));
    }
    console.log("total cvxfxs: " +totalcvxfxs.toString());

    cvxfxsHolders.blockHeight = snapshotBlock;
    cvxfxsHolders.totalcvxfxs = totalcvxfxs.toString();

    //sort
    var arr = []
    for (var i in cvxfxsHolders.addresses) {
        arr.push({address:i,num:new BN(cvxfxsHolders.addresses[i])})
    }
    arr.sort(compare);
    cvxfxsHolders.addresses = {};
    for(var i in arr){
        var amount = arr[i].num.toString()
        cvxfxsHolders.addresses[arr[i].address] = amount;
    }

	jsonfile.writeFileSync(cvxfxsfinal_file, cvxfxsHolders, { spaces: 4 });
}

main();