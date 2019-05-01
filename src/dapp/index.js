import DOM from './dom';
import Contract from './contract';
import './flightsurety.css';


(async () => {

    let result = null;

    let available_flights = [];

    function resolveFlight(flightnr) {
        for (let i = 0; i < available_flights.length; i++) {
            if (available_flights[i].fn === flightnr) {
                return available_flights[i];
            }
        }
        return null;
    }

    let contract = new Contract('localhost', () => {
        let self = this;

        // Initialize flights
        available_flights = [{
                time: "09:15",
                timestamp: Math.floor(Date.now() / 1000),
                target: "New York",
                fn: "NY674",
                airline: contract.owner,
                status: "0"
            },
            {
                time: "16:45",
                timestamp: Math.floor(Date.now() / 1000),
                target: "Las Vegas",
                fn: "LV1126",
                airline: contract.owner,
                status: "0"
            },
            {
                time: "01:25",
                timestamp: Math.floor(Date.now() / 1000),
                target: "Vancouver",
                fn: "VA222",
                airline: contract.owner,
                status: "0"
            },
            {
                time: "10:05",
                timestamp: Math.floor(Date.now() / 1000),
                target: "Dallas",
                fn: "DLL941",
                airline: contract.owner,
                status: "0"
            },
            {
                time: "10:30",
                timestamp: Math.floor(Date.now() / 1000),
                target: "Toronto",
                fn: "AA8017",
                airline: contract.owner,
                status: "0"
            }
        ];


        // Read transaction
        contract.isOperational((error, result) => {
            console.log(error ? error : "", "Operational Status: " + result);

            displayOperationalStatus([{
                label: 'Operational Status',
                error: error,
                value: result
            }]);
            displayFlightplan(available_flights, fetchFlightStatusCallback, registerFlightCallback);
            contract.insuranceBalance(insuranceBalanceCallback);
        });

        // User-submitted transaction
        DOM.elid('passengerWithdraw').addEventListener('click', () => {
            contract.passengerWithdraw(function () {
                contract.insuranceBalance(insuranceBalanceCallback);
            });
        });

        contract.oracleReport(result => {
            console.log(JSON.stringify(result));
        });

        contract.flightStatusInfo(result => {
            console.log("*** VERIFIED: " + JSON.stringify(result) + " ****");
            let updateFlight = resolveFlight(result.flight);
            if (updateFlight !== null) {
                updateFlight.status = result.status;
                let flight_row = DOM.elid("row_" + result.flight);
                displayUpdateFlightplanRow(flight_row, updateFlight, fetchFlightStatusCallback, registerFlightCallback);
            } else {
                console.log("Flight not found.");
            }

            contract.insuranceBalance(insuranceBalanceCallback);
        });
    });

    function registerFlightCallback(flight, value) {
        contract.registerFlight(resolveFlight(flight), value, () => {
            console.log("Flight registered for insurance: " + JSON.stringify(flight));
        })
    }

    function fetchFlightStatusCallback(flight) {
        contract.fetchFlightStatus(resolveFlight(flight), (error, result) => {
            if (error) {
                console.log(error);
            } else {
                console.log(result)
            }
        });
    }

    function insuranceBalanceCallback(result) {
        displayBalance(result);
    }

})();

function displayBalance(value) {
    let divBalance = DOM.elid("passangerBalance");
    divBalance.innerHTML = value + ' ETH';
}

function displayFlightplan(flights, fetchFlightStatusCallback, registerFlightCallback) {
    let displayDiv = DOM.elid("display-wrapper");
    displayDiv.innerHTML = "";

    // Available Flights
    let sectionFlightPlan = DOM.section();
    sectionFlightPlan.appendChild(DOM.h2("Flightplan"));

    if (flights !== null) {
        sectionFlightPlan.appendChild(DOM.h5("Currently available flights"));

        let firstRow = sectionFlightPlan.appendChild(DOM.div({
            id: 0,
            className: 'row'
        }));

        firstRow.appendChild(DOM.div({
            className: 'col-sm-1 field-value',
            style: {
                margin: 'auto 0 auto 0'
            }
        }, "Time"));

        firstRow.appendChild(DOM.div({
            className: 'col-sm-1 field-value',
            style: {
                margin: 'auto 0 auto 0'
            }
        }, "Flight code"));


        firstRow.appendChild(DOM.div({
            className: 'col-sm-3 field-value',
            style: {
                margin: 'auto 0 auto 0'
            }
        }, "Destiny"));

        firstRow.appendChild(DOM.div({
            className: 'col-sm-1 field-value',
            style: {
                margin: 'auto 0 auto 0'
            }
        }, "Flight status"));

        firstRow.appendChild(DOM.div({
            className: 'col-sm-1 field-value',
            style: {
                margin: 'auto 0 auto 0'
            }
        }, "Insurance Price "));


        
        flights.map((flight) => {
            let row_id = 'row_' + flight.fn;

            let row = sectionFlightPlan.appendChild(DOM.div({
                id: row_id,
                className: 'row'
            }));
            displayUpdateFlightplanRow(row, flight, fetchFlightStatusCallback, registerFlightCallback);

            sectionFlightPlan.appendChild(row);
        })

    } else {
        sectionFlightPlan.appendChild(DOM.h5("Loading available Flights..."));
    }

    displayDiv.append(sectionFlightPlan);


}

function displayUpdateFlightplanRow(row, flight, fetchFlightStatusCallback, registerFlightCallback) {

    function resolveStatusText(status_id) {
        switch (status_id) {
            case "0":
                return "Unknown";

            case "10":
                return "On Time";

            case "20":
                return "Late Airline";

            case "30":
                return "Later Weather";

            case "40":
                return "Late Technical";

            case "50":
                return "Late Other";
        }

        return "not Available";
    }

    row.innerHTML = "";

    let dataElementId = flight.fn + '_value';
    
    row.appendChild(DOM.div({
        className: 'col-sm-1 field-value',
        style: {
            margin: 'auto 0 auto 0'
        }
    }, flight.time));
    row.appendChild(DOM.div({
        className: 'col-sm-1 field-value',
        style: {
            margin: 'auto 0 auto 0'
        }
    }, flight.fn));
    row.appendChild(DOM.div({
        className: 'col-sm-2 field-value',
        style: {
            margin: 'auto 0 auto 0'
        }
    }, flight.target));
    row.appendChild(DOM.div({
        className: 'col-sm-2 field',
        style: {
            margin: 'auto 0 auto 0',
            color: flight.status === "20" ? '#FF0000' : '#FFFFFF'
        }
    }, resolveStatusText(flight.status)));

    let edtValue = DOM.input({
        id: dataElementId,
        className: 'field-value',
        style: {
            margin: 'auto 5px auto 30px',
            width: '40px',
            'text-align': 'center'
        },
        value: '0.8'
    });
    row.appendChild(edtValue);

    row.appendChild(DOM.div({
        className: 'field-value',
        style: {
            margin: 'auto 0 auto 0',
            width: '40px'
        }
    }, "ETH"));

    let buttonInsuring = DOM.button({
        className: 'btn ',
        style: {
            margin: '5px'
        }
    }, "Buy insurance");
    buttonInsuring.addEventListener('click', () => {
        registerFlightCallback(flight.fn, DOM.elid(dataElementId).value);
    });
    row.appendChild(buttonInsuring);

    let buttonFetchStatus = DOM.button({
        className: 'btn btn-primary',
        style: {
            margin: 'auto 0 auto 40px'
        }
    }, "Get Status");
    buttonFetchStatus.addEventListener('click', () => {
        fetchFlightStatusCallback(flight.fn);
    });
    row.appendChild(buttonFetchStatus);

}

function displayOperationalStatus(status) {
    let displayDiv = DOM.elid("display-wrapper-operational");
    displayDiv.innerHTML = "";

    let sectionOperationalStatus = DOM.section();
    sectionOperationalStatus.appendChild(DOM.h4('Operational Status'));
    sectionOperationalStatus.appendChild(DOM.h5('Check if contract is operational'));
    status.map((result) => {
        let row = sectionOperationalStatus.appendChild(DOM.div({
            className: 'row'
        }));
        row.appendChild(DOM.div({
            className: 'col-sm-4 field'
        }, result.label));
        row.appendChild(DOM.div({
            className: 'col-sm-8 field-value'
        }, result.error ? String(result.error) : String(result.value)));
        sectionOperationalStatus.appendChild(row);
    })
    displayDiv.append(sectionOperationalStatus);
};
