'use strict';

function initDrivers() {
  var customSensor;
  try {
    customSensor = require('./driver/airqSensor');
  } catch(e) { }

  return {
    'airqSensor': customSensor
  };
}

function initNetworks() {
  var customNetwork;
  try {
    customNetwork = require('./network/rs485-maestro');
  } catch (e) { }

  return {
    'rs485-maestro': customNetwork
  };
}

module.exports = {
  networks: ['rs485-maestro'],
  drivers: {
    airqSensor: [
      'airqTemp',
      'airqHumi',
      'airqCo2',
      'airqFreemem'
    ]
  },
  initNetworks: initNetworks,
  initDrivers: initDrivers
};

