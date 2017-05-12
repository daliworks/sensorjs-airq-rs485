'use strict';

var sensorDriver = require('../../index');
var Network = sensorDriver.Network;
var Device = sensorDriver.Device;
var util = require('util');
var _ = require('lodash');
var async = require('async');

// 1. Rename the network name 'RS485Maestro'
function RS485Maestro(options) {
  Network.call(this, 'rs485-maestro', options);
}

util.inherits(RS485Maestro, Network);

function template(str, tokens) {
  return str && str.replace(/\{(\w+)\}/g, function (x, key) {
    return tokens[key];
  });
}

RS485Maestro.prototype.discover = function (networkName/*driverOrModel*/, options, cb) {
  var self = this,
      founds = [],
      models,
      modelCount;

  if (typeof options === 'function') {
    cb = options;
    options = undefined;
  }

  if (networkName !== 'rs485-maestro') {
    return;
  }

  var props = sensorDriver.getSensorProperties('airqSensor');
  var sensorIdCo2 = template(props.idTemplate, { model: 'co2', address: '1' });
  var sensorIdTemperature = template(props.idTemplate, { model: 'temperature', address: '1' });
  var sensorIdHumidity = template(props.idTemplate, { model: 'humidity', address: '1' });
  var sensorIdFreemem = template(props.idTemplate, { model: 'number', address: '1' });
  var device = new Device(
    self/*network*/,
    '1'/*address*/,
    'maestro'/*modelId*/,
    [
      { 
        id: sensorIdCo2,
        model: 'airqCo2',
        options:{ name: '이산화탄소' }
      },
      {
        id: sensorIdTemperature,
        model: 'airqTemp',
        options:{ name: '온도' }
      },
      {
        id: sensorIdHumidity,
        model: 'airqHumi',
        options:{ name: '습도' }
      },
      {
        id: sensorIdFreemem,
        model: 'airqFreemem',
        options:{ name: '메모리' }
      }
    ]/*sensorInfos*/
  );
  var error;
  founds.push(device);
  self.emit('discovered', device);
  return cb && cb(error,founds);
};

module.exports = new RS485Maestro();