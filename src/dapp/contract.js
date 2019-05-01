import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {

        async function initilizeProvider() {

            if (window.ethereum) {
                try {
                    // Request account access
                    await window.ethereum.enable();

                    return window.ethereum;;
                } catch (error) {
                    // User denied account access...
                    console.error("User denied account access")
                }
            }
            // Legacy dapp browsers...
            else if (window.web3) {
                return window.web3.currentProvider;
            }
            // If no injected web3 instance is detected, fall back to Ganache
            else {
                return new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws'));
            }

        }

        let self = this;
        initilizeProvider().then(function (provider) {
            let config = Config[network];
            self.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
            self.web3Metamask = new Web3(provider);
            self.flightSuretyApp = new self.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
            self.flightSuretyData = new self.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
            self.flightSuretyAppMetamask = new self.web3Metamask.eth.Contract(FlightSuretyApp.abi, config.appAddress);
            self.initialize(callback, config);
            self.owner = null;
            self.airlines = [];
            self.passengers = [];
        });
    }

    initialize(callback, config) {
        this.web3.eth.getAccounts((error, accts) => {

            this.owner = accts[0];

            let counter = 1;

            while (this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while (this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }

            this.flightSuretyData.methods
                .authorizeCaller(config.appAddress)
                .call({
                    from: self.owner
                }, callback);

            callback();
        });

        this.web3Metamask.eth.getAccounts((error, accts) => {

            this.ownerMetamask = accts[0];

            callback();
        });
    }

    isOperational(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .isOperational()
            .call({
                from: self.owner
            }, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.owner,
            flight: flight.fn,
            timestamp: flight.timestamp
        }
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({
                from: self.owner
            }, (error, result) => {
                callback(error, payload);
            });
    }

    oracleReport(callback) {
        let self = this;
        self.flightSuretyApp.events.OracleReport({}, function (error, event) {
            if (error) {
                console.log(error);
            } else {
                callback(event.returnValues);
            }
        })
    }

    flightStatusInfo(callback) {
        let self = this;
        self.flightSuretyApp.events.FlightStatusInfo({}, function (error, event) {
            if (error) {
                console.log(error);
            } else {
                callback(event.returnValues);
            }
        })
    }

    registerFlight(flight, value, callback) {
        let self = this;
        self.flightSuretyAppMetamask.methods
            .registerFlight(flight.airline, flight.fn, flight.timestamp)
            .send({
                from: self.ownerMetamask,
                value: self.web3.utils.toWei(value, "ether")
            }, (error, result) => {
                if (error) {
                    console.log(error);
                } else {
                    callback(result);
                }
            });
    }

    insuranceBalance(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .insureeBalance()
            .call({
                from: self.ownerMetamask
            }, function (error, result) {
                if (error) {
                    console.log(error);
                } else {
                    callback(self.web3.utils.fromWei(result, "ether"));
                }
            })
    }

    passengerWithdraw(callback) {
        let self = this;
        self.flightSuretyApp.methods
            .withdraw()
            .send({
                from: self.ownerMetamask
            }, (error, result) => {
                if (error) {
                    console.log(error);
                }

                callback();
            });
    }
}
