'use strict';

// create an empty modbus client 
var ModbusRTU = require('modbus-serial');
var fs = require('fs');
var client = new ModbusRTU();
var logger = {};
var PORT_NAME = '/dev/ttyS1';
var GET_CO2 = 0x65;
var GET_TEMPERATURE = 0x66;
var GET_HUMIDITY = 0x67;
var GET_CO = 0x68;
var GET_SLAVE_ID = 0x69;
var NODE_QUERY_MAX_TIME = 15;

var devIds = [];
var sensorValues = {
  co2:{},
  temperature:{},
  //humidity:{},
  //number:null
  humidity:{}
};

// ex)
// {
//  co2: {
//    '1': {
//      value:100,
//      ts:14023289110 
//    },
//    '2': {
//      value:200,
//      ts:14023289110
//    }
//  },
//  temperature: {
//    '1': {
//      value:123,
//      ts:14012359201
//    },
//    '2': {
//      value:234,
//      ts:14012359201
//    }
//  },
//  humidity: {
//    '1': {
//      value:345,
//      ts:14012359201
//    },
//    '2': {
//      value:456,
//      ts:14012359201
//    }
//  }
//}

// logger가 set 되기 전에 호출되는 경우 오류 방지
if (!logger.info || typeof logger.info !== 'function' ) {
  logger.info = function() {};
}

exports.setLogger = function(l) {
  logger = l;
};

exports.addDevice = function(deviceAddress) {
  if (devIds.indexOf(deviceAddress) < 0) {
    logger.info('Device is added:', deviceAddress);
    devIds.push(deviceAddress);
  }
};

/**
 * 센서값을 읽어오는 목적의 interface method.
 *
 *  Tube app에 의해 주기적으로 호출되는 구조임.
 *  Periodically 실행이 요구되는 작업을 여기서 처리해 주어도 무방함.
 */
exports.getSensorValue = function(deviceAddress, sensorType) {
  var sensorValueValidTimeLimit;

  if (sensorType === 'number') {
    return sensorValues[sensorType];
  }

  // 지정한 센서 값이 없음.
  if (!sensorValues[sensorType][deviceAddress]) {
    return null;
  }

  // 지정한 센서의 감지 시간이 120초 이내인 경우에만 유효함.
  sensorValueValidTimeLimit = (new Date()).getTime() - (1000 * 120);
  if (sensorValues[sensorType][deviceAddress].ts > sensorValueValidTimeLimit) {
    return sensorValues[sensorType][deviceAddress];
  }

  return null;
};

function printValues(values) {
  var items = [];
  var logStr;

  for (var key in values) {
    //if (['co2','temperature','humidity','number'].indexOf(key) >= 0) {
    if (['co2', 'temperature', 'humidity'].indexOf(key) >= 0) {
      items.push(key + ':' + values[key].value + '(' + values[key].ts + ')');
    }
  }

  logStr = items.join(', ');
  logger.info(logStr);
}

function readSensors(deviceId) {
  var values = {};
  var isInvalidDeviceAddress = (/[^0-9]/.test(deviceId) || Number(deviceId) < 1 || Number(deviceId) > 255);

  if (isInvalidDeviceAddress) {
    logger.warn('Device ID should be 1 ~ 255 because it is for RS485 slave ID.');
    logger.warn('Cannot read the sensor value.');
    return;
  }

  // 1. CO2 read
  logger.debug(deviceId, 'CO2 read');
  client.readHoldingRegisters(GET_CO2, 1, function(err, co2) {
    logger.debug(deviceId, 'CO2 end');
    if (err) {
      logger.debug('ERROR - CO2 read error');
      logger.debug(err);
      return;
    }

    // log output data
    values.co2 = {
      value: co2.data[0],
      ts: (new Date()).getTime()
    };

    // Thing+ data to transfer
    sensorValues.co2[deviceId] = {
      value: co2.data[0],
      ts: (new Date()).getTime()
    };

    setTimeout(function readTempSensor() {

      // 2. Temperature read
      logger.debug(deviceId, 'Temperature read');
      client.readHoldingRegisters(GET_TEMPERATURE, 1, function(err, temperature) {
        logger.debug(deviceId, 'Temperature end');
        if (err) {
          logger.debug('ERROR - Temperature read error');
          logger.debug(err);
          printValues(values);
          return;
        }

        // log output data
        values.temperature = {
          value: temperature.data[0],
          ts: (new Date()).getTime()
        };

        // Thing+ data to transfer
        sensorValues.temperature[deviceId] = {
          value: temperature.data[0],
          ts: (new Date()).getTime()
        };

        setTimeout(function readHumiSensor() {

          // 3. Humidity read
          logger.debug(deviceId, 'Humidity read');
          client.readHoldingRegisters(GET_HUMIDITY, 1, function(err, humidity) {
            logger.debug(deviceId, 'Humidity end');
            if (err) {
              logger.debug('ERROR - Humidity read error');
              logger.debug(err);
              printValues(values);
              return;
            }

            // log output data
            values.humidity = {
              value: humidity.data[0],
              ts: (new Date()).getTime()
            };

            // Thing+ data to transfer
            sensorValues.humidity[deviceId] = {
              value: humidity.data[0],
              ts: (new Date()).getTime()
            };

            printValues(values);
          });
        }, 2000);
      });
    }, 2000);
  });
}

var reserveSensorReading = function(id){
  logger.debug('Device', id, 'start to read sensor value');
  client.setID(Number(id));
  readSensors(id);
};

function kickSensorReader() {
  // Read sensor value again after waiting for 10 seconds if no registered AirQ sensor node
  var numDev = devIds.length;

  if (!numDev) {
    setTimeout(kickSensorReader, 10 * 1000);
    return;
  }

  /*
  fs.readFile('/proc/meminfo', 'utf8', function(err, data) {
    var lines;
    var filteredLines;
    var line;
    var words;
    var freeMemory;

    if (err) {
      return;
    }

    lines = data.split('\n');
    filteredLines = lines.filter(function(item) {
      if (item.indexOf('MemFree:') === 0) {
        return 1;
      }

      return 0;
    });

    if (filteredLines.length !== 1) {
      return;
    }

    line = filteredLines[0].replace(/[\s]+/g,' ');
    words = line.split(' ');
    freeMemory = Number(words[1]);
    sensorValues.number = {
      value: freeMemory,
      ts: (new Date()).getTime()
    };
  });
  */

  logger.debug('Number of devices:', numDev);
  logger.debug('It is scheduled after %d seconds to restart reading sensor value',
              numDev * NODE_QUERY_MAX_TIME);
  setTimeout(kickSensorReader, numDev * NODE_QUERY_MAX_TIME * 1000);

  for (var i = 0; i < devIds.length; i++) {
    setTimeout(reserveSensorReading, i * NODE_QUERY_MAX_TIME * 1000, devIds[i]);
  }
}

function init(err) {
  if (err) {
    logger.info('connection error:', err);
    return;
  }

  logger.info('Connected');
  kickSensorReader();
}

client.connectRTU(PORT_NAME, { baudrate: 9600 }, init);
