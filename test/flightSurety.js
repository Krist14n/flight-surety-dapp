var Web3Utils = require('web3-utils');
var Web3 = require('web3')
web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {
  const ORACLES_COUNT = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    //await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });

    // check if caller is authorized 
    it(`(security) caller is not yet authorized`, async function () {
        let result = await config.flightSuretyData.isAuthorizedCaller(config.flightSuretyApp.address);
        assert.equal(result, false, "Caller is authorized but has not registered.");
    });

    it(`(security) caller is now authorized`, async function () {
        await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
        let result = await config.flightSuretyData.isAuthorizedCaller(config.flightSuretyApp.address);
        assert.equal(result, true, "Caller is not authorized but was registered.");
    });
  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

    // 	First airline is registered when contract is deployed.
    it(`(contract init) first airline is registered when contract is deployed.`, async function () {
        let result = await config.flightSuretyData.isFirstAirlineRegistered.call(config.firstAirline);
        assert.equal(result, true, "First airline was not registred on deployment");
    });

    it(`(multiparty consensus) has correct initial isOperational() value`, async function () {

        // Get operating status
        let status = await config.flightSuretyData.isOperational.call();
        assert.equal(status, true, "Incorrect initial operating status value");

    });
  
    it(`(multiparty consensus) block access to setOperatingStatus() for non-Contract Owner account`, async function () {

        // Ensure that access is denied for non-Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
                
    });
  
    it(`(multiparty consensus) allow access to setOperatingStatus() for Contract Owner account`, async function () {

        // Ensure that access is allowed for Contract Owner account
        let accessDenied = false;
        try 
        {
            await config.flightSuretyData.setOperatingStatus(false);
        }
        catch(e) {
            accessDenied = true;
        }
        assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
        
    });
    
    it(`(multiparty consensus) block access to functions using requireIsOperational when operating status is false`, async function () {

        await config.flightSuretyData.setOperatingStatus(false);

        let reverted = false;
        try 
        {
            await config.flightSurety.setTestingMode(true);
        }
        catch(e) {
            reverted = true;
        }
        assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

        // Set it back for other tests to work
        await config.flightSuretyData.setOperatingStatus(true);

    });
  
    it('(airline functions) cannot register an Airline using registerAirline() if it is not funded', async () => {
        
        // ARRANGE
        let newAirline = accounts[2];

        // ACT
        let reverted = false;
        try {
            await config.flightSuretyApp.registerAirline.call(newAirline, {from: config.firstAirline});
        }
        catch(e) {
            let reverted = true;
        }
        //let result = await config.flightSuretyData.isAirline.call(newAirline); 

        // ASSERT
        assert.equal(reverted, false, "Airline should not be able to register another airline if it hasn't provided funding");

    });
 
    it('(airline functions) fund first airline (low funds)', async () => {
        let fund = await config.flightSuretyApp.AIRLINE_LOW_FUND.call();

        // ACT
        let reverted = false;
        try {
            await config.flightSuretyApp.fundAirline.call({
                from: config.firstAirline,
                value: fund,
                gasPrice: 0
            });
        } catch (e) {
            reverted = true;
        }

        // ASSERT
        assert.equal(reverted, true, "Airline seed fund should reach the minimum of 10 ether.");
    });

    it('(airline functions) fund first airline (enough funds)', async () => {
        let fund = await config.flightSuretyApp.AIRLINE_FUND.call();

        // ACT
        let reverted = false;
        let balance = 0;
        try {
            await config.flightSuretyApp.fundAirline({
                from: config.firstAirline,
                value: fund.toString(),
                gasPrice: 0
            });
            balance = await config.flightSuretyData.getBalance({
                from: config.owner
            });
        } catch (e) {
            console.log(e);
            reverted = true;
        }

        // ASSERT
        assert.equal(balance.toString(10), fund.toString(), "Unexcected Airline balance");
        assert.equal(reverted, false, "Airline seed not accepted");
    });

    it('(airline functions) register an Airline using registerAirline() if it is funded', async () => {

        // ARRANGE
        let newAirline = accounts[2];

        // ACT
        let reverted = false;
        try {
            await config.flightSuretyApp.registerAirline(newAirline, {
                from: config.firstAirline
            });
        } catch (e) {
            reverted = true;
        }

        // ASSERT
        assert.equal(reverted, false, "Airline should be able to register another airline");
    });

    it('(airline functions) prevent registerAirline() duplicate registry', async () => {

        // ARRANGE
        let newAirline = accounts[2];

        // ACT
        let reverted = false;
        try {
            await config.flightSuretyApp.registerAirline(newAirline, {
                from: config.firstAirline
            });
        } catch (e) {
            reverted = true;
        }

        // ASSERT
        assert.equal(reverted, true, "Airline should not be registred twice");
    });

    it('(airline functions) can register airlines until mulitparty consensus limit is reached', async () => {

        // ARRANGE
        let newAirline2 = accounts[3];
        let newAirline3 = accounts[4];
        let newAirline4 = accounts[5];

        // ACT
        let registerBelowThreshold = true;

        try {
            await config.flightSuretyApp.registerAirline(newAirline2, {
                from: config.firstAirline
            });
            await config.flightSuretyApp.registerAirline(newAirline3, {
                from: config.firstAirline
            });
            await config.flightSuretyApp.registerAirline(newAirline4, {
                from: config.firstAirline
            });
        } catch (e) {
            registerBelowThreshold = false;
            console.log("ERROR: " , e);
        }

        // ASSERT
        assert.equal(registerBelowThreshold, true, "Can not register Airlines but should work");
        assert.equal(await config.flightSuretyApp.airlinesRegisteredCount.call(), 4, "Threshold ignored");
    });

    it('(airline functions) fund airline 2-4 (first is funded)', async () => {

        // ARRANGE
        let fund = await config.flightSuretyApp.AIRLINE_FUND.call();

        let newAirline = accounts[2];
        let newAirline2 = accounts[3];
        let newAirline3 = accounts[4];

        // ACT
        let rejected = false;

        try {
            await config.flightSuretyApp.fundAirline({
                from: newAirline,
                value: fund.toString(),
                gasPrice: 0
            });
            await config.flightSuretyApp.fundAirline({
                from: newAirline2,
                value: fund.toString(),
                gasPrice: 0
            });
            await config.flightSuretyApp.fundAirline({
                from: newAirline3,
                value: fund.toString(),
                gasPrice: 0
            });
        } catch (e) {
            rejected = true;
        }

        // ASSERT
        assert.equal(rejected, false, "Airlines not funded");
    });

    it('(airline functions) register 5th Airline - requires multiparty consensus', async () => {

        // ARRANGE
        let fund = await config.flightSuretyApp.AIRLINE_FUND.call();

        let newAirline = accounts[6];

        let airline2 = accounts[2];
        let airline3 = accounts[3];

        // Register new Airline - shouldn't change anything
        await config.flightSuretyApp.registerAirline(newAirline, {
            from: airline2
        });
        assert.equal(await config.flightSuretyApp.airlinesRegisteredCount.call(), 4, "Threshold ignored");

        // Register new Airline - airline 2 vote twice
        let rejectMultivote = false;
        try {
            await config.flightSuretyApp.registerAirline(newAirline, {
                from: airline2
            });
        } catch (e) {
            rejectMultivote = true;
        }
        assert.equal(rejectMultivote, true, "Multivote not rejected");
        assert.equal(await config.flightSuretyApp.airlinesRegisteredCount.call(), 4, "Multivote possible");

        // Register new Airline - now airline 2 and airline 3 votes for new airline
        await config.flightSuretyApp.registerAirline(newAirline, {
            from: airline3
        });
        assert.equal(await config.flightSuretyApp.airlinesRegisteredCount.call(), 5, "Consensus not reached");
    });

    it('(insurance functions) Buy insurance for flight (exeeded max payment)', async () => {

        let insuree = accounts[7];
        let airline = accounts[2];
        let flight = 'ND1309';
        let value = Web3Utils.toWei("1.1", "ether");

        let rejected = false;

        try {
            await config.flightSuretyApp.registerFlight(airline, flight, 0, {
                from: insuree,
                value: value,
                gasPrice: 0
            });
        } catch (e) {
            rejected = true;
        }

        // ASSERT
        assert.equal(rejected, true, "Max payment should not exeeded.");
    });

    it('(insurance functions) Buy insurance for flight', async () => {

        let insuree = accounts[7];
        let airline = accounts[2];
        let flight = 'ND1309';
        let value = Web3Utils.toWei("1", "ether");

        let rejected = false;

        try {
            await config.flightSuretyApp.registerFlight(airline, flight, 0, {
                from: insuree,
                value: value,
                gasPrice: 0
            });
        } catch (e) {
            rejected = true;
            console.log(e);
        }

        // ASSERT
        assert.equal(rejected, false, "Can´t buy insurance.");
    });

    it('(insurance functions) prevent buying more then one insurance for flight', async () => {

        let insuree = accounts[7];
        let airline = accounts[2];
        let flight = 'ND1309';
        let value = Web3Utils.toWei("0.7", "ether");

        let rejected = false;

        try {
            await config.flightSuretyApp.registerFlight(airline, flight, 0, {
                from: insuree,
                value: value,
                gasPrice: 0
            });
        } catch (e) {
            rejected = true;
        }

        // ASSERT
        assert.equal(rejected, true, "Can insure flight more then one time.");
    });

    it('(passenger functions) check balance should be 0', async () => {
        let insuree = accounts[7];
        let rejected = false;
        let balance = 100;

        try {
            balance = await config.flightSuretyApp.insureeBalance({
                from: insuree
            });

        } catch (e) {
            rejected = true;
        }

        // ASSERT
        assert.equal(rejected, false, "Failure on check balance.");
        assert.equal(balance.toNumber(), 0, "Invalid balance.");
    });

    it('(oracles functions) bruteforce submitOracleResponse() to emit processFlightStatus()', async () => {
        // ARRANGE
        let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
        let airline = accounts[2];
        let flight = 'ND1309';

        // ACT
        for (let a = 1; a < ORACLES_COUNT; a++) {
            await config.flightSuretyApp.registerOracle({
                from: accounts[a],
                value: fee
            });
            await config.flightSuretyApp.fetchFlightStatus(airline, flight, 0, {
                from: accounts[a]
            });

            for (let idx = 0; idx < 9; idx++) {
                try {
                    await config.flightSuretyApp.submitOracleResponse(idx, airline, flight, 0, STATUS_CODE_LATE_AIRLINE, {
                        from: accounts[a]
                    });
                    console.log("Bruteforce successful");
                } catch (e) {
                    //console.log(e.message); // for Debugging
                }
            }
        }
    });

    it('(passenger functions) check balance after credited (no withdraw)', async () => {
        let insuree = accounts[7];
        let rejected = false;
        let balance = 0;

        try {
            balance = await config.flightSuretyApp.insureeBalance({
                from: insuree
            });
        } catch (e) {
            rejected = true;
        }

        // ASSERT
        assert.equal(rejected, false, "Failure on check balance.");
        assert.equal(balance.toString(), new BigNumber("1500000000000000000").toString(), "Invalid balance.");
    });

    it('(passenger functions) withdraw to account', async () => {
        let insuree = accounts[7];
        let initialBalance = await web3.eth.getBalance(insuree);
        let balance = 1000;

        let rejected = false;
        try {
            await config.flightSuretyApp.withdraw({
                from: insuree
            });
            balance = await config.flightSuretyApp.insureeBalance({
                from: insuree
            });
        } catch (e) {
            rejected = true;
            console.log(e);
        }

        let currentBalance = await web3.eth.getBalance(insuree);

        assert.equal(rejected, false, "Failure on withdraw to passanger account.");
        assert.equal(balance.toString(), "0", "Balance should be 0");
        assert.equal(new BigNumber(currentBalance.toString()).isGreaterThan(new BigNumber(initialBalance.toString())), true, "Invalid balance on account");
    });

    it('(passenger functions) prevent withdraw to account (twice)', async () => {
        let insuree = accounts[7];
        let initialBalance = await web3.eth.getBalance(insuree);

        let rejected = false;
        try {
            await config.flightSuretyApp.withdraw({
                from: insuree
            });
        } catch (e) {
            rejected = true;
            console.log(e);
        }

        let currentBalance = await web3.eth.getBalance(insuree);

        assert.equal(rejected, false, "Failure on withdraw to passanger account.");
        assert.equal(new BigNumber(currentBalance.toString()).isEqualTo(new BigNumber(initialBalance.toString())), false, "Invalid balance on account");
    });

});
