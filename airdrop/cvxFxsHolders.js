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
    //"0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf":"0x4F64c22FB06ab877Bf63f7064fA21C5c51cc85bf",//vesq
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

const getPoolHolders = async (snapshotBlock, startBlock, lpaddress, gauge, rewardAddress) => {
    console.log("Getting lp holders");
    var logCount = 20000;
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
    var lpcvxfxs = await cvxFxsContract.balanceOf(lpaddress, { blockTag: snapshotBlock });
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
    var logCount = 20000;
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
    delete holders["0x49b4d1dF40442f0C31b1BbAEA3EDE7c38e37E31a"];

    holders = await getBalances(cvxfxsAddress,holders,snapshotBlock );
    return holders;
}

const getcvxFxsStakers = async (snapshotBlock) => {
    console.log("Getting cvxFxs stakers");
    var cvxFxsContract = new ethers.Contract(stkcvxfxsAddress, CRV_ABI, provider);
    var instance = cvxFxsContract.connect(provider);
    var logCount = 20000;
    var startBlock = 16780566;
    var holders = {};
    // holders.addresses = {};
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
    var lpers = await getPoolHolders(snapshotBlock,17532777,"0x6a9014FB802dCC5efE3b97Fd40aAa632585636D0","0x0c58c509305a8a7fE9a6a60CEaAC6185B96ECBb7","0x19F3C877eA278e61fE1304770dbE5D78521792D2");
 
    var holdersstakers = combine(holders,stakers);
    cvxfxsHolders.addresses = combine(holdersstakers,lpers);
    delete cvxfxsHolders.addresses["0x6a9014FB802dCC5efE3b97Fd40aAa632585636D0"];

    var totalHeldcvxfxs = BN(0);
    for (var i in cvxfxsHolders.addresses) {
        totalHeldcvxfxs.add(new BN(cvxfxsHolders.addresses[i]));
    }
    console.log("total held: " +totalHeldcvxfxs.toString());

    //redirects
    var rkeys = Object.keys(redirects);
    for(var i=0; i < rkeys.length; i++){
        var from = rkeys[i];
        var to = redirects[from];
        console.log("redirect from " +from +"  to  " +to);
        if(cvxfxsHolders.addresses[from] != undefined){
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