'use strict';

var SensorLib = require('../../index');
var Sensor = SensorLib.Sensor;
var util = require('util');
var fs = require('fs');
var _ = require('lodash');
var logger = Sensor.getLogger();
var AirQRS485Driver = require('./AirQRS485Driver');

AirQRS485Driver.setLogger(logger);

function AirqSensor(sensorInfo, options) {
  var self = this;
  Sensor.call(self, sensorInfo, options);

  if (sensorInfo.model) {
    self.model = sensorInfo.model;
  }

  self.dataType = AirqSensor.properties.dataTypes[self.model][0];
}

AirqSensor.properties = {
  supportedNetworks: ['rs485-maestro'],
  dataTypes: {
    airqCo2: ['co2'],
    airqTemp: ['temperature'],
    airqHumi: ['humidity'],
    airqFreemem: ['number']
  },
  discoverable: false,
  addressable: true,
  recommendedInterval: 60000,
  maxInstances: 5,
  maxRetries: 8,
  idTemplate: '{model}-{address}',
  models: ['airqCo2','airqTemp','airqHumi','number'],
  category: 'sensor'
};

util.inherits(AirqSensor, Sensor);


// When the 'get' method of created sensor instance is called.
AirqSensor.prototype._get = function (cb) {
  var self = this,
      rtn;

  // console.log(self);
  var deviceAddress = self.device.address;
  AirQRS485Driver.addDevice(deviceAddress);

  var type = AirqSensor.properties.dataTypes[self.model][0];
  logger.info('AirqSensor.prototype._get() - type:', type, 'deviceAddress:', deviceAddress);
  var objValue = AirQRS485Driver.getSensorValue(deviceAddress,type);
  if (objValue) {
    var data = objValue.value;
    if (['temperature','humidity'].indexOf(type) >= 0) {
      data = data/10;
    }
    rtn = { status: 'ok', id : self.id, result: {} };
    rtn.result[type] = data;
  } else {
    rtn = { status: 'error', id : self.id, message: 'sensor is not ready yet' };
  }

  if (cb) {
    return cb(rtn.message, rtn);
  } else {
    self.emit('data', rtn);
    return;
  }
};

// 3. Custom function to watch the change of sensor value
function watchSensorValue(cb) {
  var error, data;

  // Place codes here to watch sensor value (e.g. on, off)

  return cb && cb(error, data);
}

// When the 'clear' method of created sensor instance is called.
AirqSensor.prototype._clear = function () {
  // 5. Place here the clearing codes.

  return;
};


module.exports = AirqSensor;

