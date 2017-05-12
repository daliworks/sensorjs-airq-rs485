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
    customNetwork = require('./network/rs485-airq');
  } catch (e) { }

  return {
    'rs485-airq': customNetwork
  };
}

module.exports = {
  networks: ['rs485-airq'],
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

