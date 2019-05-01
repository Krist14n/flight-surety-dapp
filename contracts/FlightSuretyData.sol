pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner;                                      // Account used to deploy contract
    bool private operational = true;                                    // Blocks all state changes throughout the contract if false
    mapping(address => uint256) private authorizedCallers;

    struct Airline {
        bool isFunded;
        bool isRegistered;
    }
    mapping (address => Airline) private airlines;

    struct FlightInsurance {
        bool isInsured;
        bool isCredited;
        uint256 amount;
    }
    mapping(bytes32 => FlightInsurance) private flightInsurances;

    mapping(address => uint256) private insureeBalances;
    mapping(bytes32 => address[]) private insureesMap;
    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor
                                (
                                    address firstAirline
                                ) 
                                public 

    {   
        contractOwner = msg.sender;
        airlines[firstAirline] = Airline({isFunded: false, isRegistered: true});
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() 
    {
        require(operational, "Contract is currently not operational");
        _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner()
    {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the caller of this contract to be authorized to use it
    */
    modifier requireIsCallerAuthorized()
    {
        require(authorizedCallers[msg.sender] == 1 || msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
    * @dev Modifier that requires the caller of this contract to have registered an airline
    */
    modifier requireIsCallerAirlineRegistered(address originSender)
    {
        require(isCallerAirlineRegistered(originSender), "Caller not registered");
        _;
    }
    
    /**
    * @dev Modifier that requires the caller of this contract to have funded the airline
    */
    modifier requireIsCallerAirlineFunded(address originSender)
    {
        require(isCallerAirlineFunded(originSender), "Caller cannot participate in contract until it submits funding");
        _;
    }

    modifier requireFlightNotInsured(address originSender, address airline, string flightNumber, uint256 timestamp)
    {
        require(!isFlightInsured(originSender, airline, flightNumber, timestamp), "Flight already insured");
        _;
    }
    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Authorize external flightSuretyApp contract to use this contract
    */
    function authorizeCaller(address externalContractAddress) external requireContractOwner
    {
        authorizedCallers[externalContractAddress] = 1;
    } 

    /**
    *@dev Deauthorize external app contract to use this contract
    */
    function deauthorizeCaller(address externalContractAddress) external requireContractOwner
    {
        delete authorizedCallers[externalContractAddress];
    }

    /**
    * @dev Checks if caller is authorized
    *
    * @return A bool is caller authorized
    */
    function isAuthorizedCaller(address externalContractAddress) public view requireContractOwner returns(bool)
    {
        return authorizedCallers[externalContractAddress] == 1;
    }

    /**
    * @dev Get operating status of contract
    *
    * @return A bool that is the current operating status
    */      
    function isOperational() 
                            public 
                            view 
                            returns(bool) 
    {
        return operational;
    }

    function isCallerAirlineRegistered(address originSender)
                            public
                            view
                            returns (bool)
    {
        return airlines[originSender].isRegistered;
    }

    function isCallerAirlineFunded(address originSender)
                            public
                            view
                            returns (bool)
    {
        return airlines[originSender].isFunded;
    }

    function isFlightInsured(address originSender, address airline, string flightNumber, uint256 timestamp)
                            public
                            view
                            returns (bool)
    {
        FlightInsurance storage insurance = flightInsurances[getInsuranceKey(originSender, airline, flightNumber, timestamp)];
        return insurance.isInsured;
    }

    /**
    * @dev Sets contract operations on/off
    *
    * When operational mode is disabled, all write transactions except for this one will fail
    */    
    function setOperatingStatus
                            (
                                bool mode
                            ) 
                            external
                            requireContractOwner 
    {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
    * @dev Check if first airline is registered
    * 
    * @return bool
    */
    function isFirstAirlineRegistered(address firstAirline)
                            external
                            view  
                            requireIsOperational
                            returns(bool)
    {
        return airlines[firstAirline].isRegistered;
    }

    /**
    *@dev get address balance
    *
    *
    */
    function getBalance
                            (
                            )
                            public
                            view
                            requireIsOperational
                            requireContractOwner
                            returns (uint256)
    {
        return address(this).balance;
    }

   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function registerAirline
                            (
                                address originSender,
                                address airline
                            )
                            external
                            requireIsOperational
                            requireIsCallerAuthorized
                            requireIsCallerAirlineRegistered(originSender)
                            requireIsCallerAirlineFunded(originSender)
                            returns(bool success)
    {
        require(!airlines[airline].isRegistered, "Airline already registred");
        airlines[airline] =  Airline({isRegistered: true, isFunded: false});
        return airlines[airline].isRegistered;
    }

    /**
    *@dev Fund an airline
    *
    */
    function fundAirline
                            (
                                address airline
                            )
                            external
                            requireIsOperational
                            requireIsCallerAuthorized
    {
        airlines[airline].isFunded = true;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */   
    function buy
                            (              
                                address originSender,
                                address airline,
                                string flightNumber,
                                uint256 timestamp,
                                uint256 amount               
                            )
                            external
                            requireIsOperational
                            requireIsCallerAuthorized
                            requireFlightNotInsured(originSender, airline, flightNumber, timestamp)
    {
        FlightInsurance storage insurance = flightInsurances[getInsuranceKey(originSender, airline, flightNumber, timestamp)];
        insurance.isInsured = true;
        insurance.amount = amount;

        // Add insuree to list of all insurees (if not exists)
        appendInsuree(originSender, airline, flightNumber, timestamp);
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                                address originSender
                            )
                            external
                            requireIsOperational
                            requireIsCallerAuthorized
    {
        require(address(this).balance > insureeBalances[originSender], "Contract out of funds");

        uint256 prev = insureeBalances[originSender];
        insureeBalances[originSender] = 0;
        originSender.transfer(prev);
    }
    
    function appendInsuree
                            (
                                address originSender,
                                address airline,
                                string flightNumber,
                                uint256 timestamp
                            )
                            internal
                            requireIsOperational
    {
        address [] storage insurees = insureesMap[getInsuranceKey(0x0, airline, flightNumber, timestamp)];
        bool duplicate = false;
        for(uint256 i = 0; i < insurees.length; i++) {
            if(insurees[i] == originSender) {
                duplicate = true;
                break;
            }
        }

        if(!duplicate) {
            insurees.push(originSender);
        }
    }

    function insureeBalance
                            (
                                address originSender
                            )
                            external
                            requireIsOperational
                            requireIsCallerAuthorized
                            view
                            returns (uint256)
    {
        return insureeBalances[originSender];
    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                    address airline,
                                    string flightNumber,
                                    uint256 timestamp
                                )
                                external
                                requireIsOperational
                                requireIsCallerAuthorized
    {
        address [] storage insurees = insureesMap[getInsuranceKey(0x0, airline, flightNumber, timestamp)];

        for(uint i = 0; i < insurees.length; i++) {
            FlightInsurance storage insurance = flightInsurances[getInsuranceKey(insurees[i], airline, flightNumber, timestamp)];

            // if instead of require so that a single mistake does not endanger the payouts of other policyholders
            if(insurance.isInsured && !insurance.isCredited) {
                insurance.isCredited = true;
                insureeBalances[insurees[i]] = insureeBalances[insurees[i]].add(insurance.amount.mul(15).div(10));
            }
        }
    }
    

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */   
    function fund
                            (   
                            )
                            public
                            payable
    {
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32) 
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function getInsuranceKey
                        (
                            address insuree,
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(insuree, airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    function() 
                            external 
                            payable 
    {
        fund();
    }


}

