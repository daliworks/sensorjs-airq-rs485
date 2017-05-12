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
  humidity:{},
  number:null
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
  logger.info = function(){};
}

exports.setLogger = function(l) {
  logger = l;
};

exports.addDevice = function(deviceAddress) {
  if (devIds.indexOf(deviceAddress) < 0) {
    logger.info('장치 추가됨:', deviceAddress);
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

  if (sensorType === 'number') {
    return sensorValues[sensorType];
  }

  // 지정한 센서 값이 없음.
  if (!sensorValues[sensorType][deviceAddress]) {
    return null;
  }

  // 지정한 센서의 감지 시간이 120초 이내인 경우에만 유효함.
  var sensorValueValidTimeLimit = (new Date()).getTime() - (1000 * 120);
  if (sensorValues[sensorType][deviceAddress].ts > sensorValueValidTimeLimit) {
    return sensorValues[sensorType][deviceAddress];
  }
  return null;
};

function printValues(values) {
  var items = [];
  for (var key in values) {
    if (['co2','temperature','humidity','number'].indexOf(key) >= 0) {
      items.push(key+':'+values[key].value+'('+values[key].ts+')');
    }
  }
  var logStr = items.join(', ');
  logger.info(logStr);
}

function readSensors(deviceId) {
  var values = {};
  var isInvalidDeviceAddress = (/[^0-9]/.test(deviceId) || Number(deviceId) < 1 || Number(deviceId) > 255);

  if (isInvalidDeviceAddress) {
    logger.warn('DeviceId는 RS485 SLAVE_ID로 사용되므로 반드시 1~255 숫자를 사용해야 함');
    logger.warn('센서값을 읽을 수 없음');
    return;
  }

  // 1. CO2 read
  logger.info(deviceId, 'CO2 read');
  client.readHoldingRegisters(GET_CO2, 1, function(err, co2) {
    logger.info(deviceId, 'CO2 end');
    if (err) {
      logger.info('ERROR - CO2 read error');
      logger.info(err);
      return;
    }

    // log 출력 데이터
    values.co2 = {
      value: co2.data[0],
      ts: (new Date()).getTime()
    };

    // Thing+ 전달용 데이터
    sensorValues.co2[deviceId] = {
      value: co2.data[0],
      ts: (new Date()).getTime()
    };

    setTimeout(function readTempSensor() {

      // 2. Temperature read
      logger.info(deviceId, 'Temperature read');
      client.readHoldingRegisters(GET_TEMPERATURE, 1, function(err, temperature) {
        logger.info(deviceId, 'Temperature end');
        if (err) {
          logger.info('ERROR - Temperature read error');
          logger.info(err);
          printValues(values);
          return;
        }

        // log 출력 데이터
        values.temperature = {
          value: temperature.data[0],
          ts: (new Date()).getTime()
        };

        // Thing+ 전달용 데이터
        sensorValues.temperature[deviceId] = {
          value: temperature.data[0],
          ts: (new Date()).getTime()
        };

        setTimeout(function readHumiSensor() {

          // 3. Humidity read
          logger.info(deviceId, 'Humidity read');
          client.readHoldingRegisters(GET_HUMIDITY, 1, function(err, humidity) {
            logger.info(deviceId, 'Humidity end');
            if (err) {
              logger.info('ERROR - Humidity read error');
              logger.info(err);
              printValues(values);
              return;
            }

            // log 출력 데이터
            values.humidity = {
              value: humidity.data[0],
              ts: (new Date()).getTime()
            };

            // Thing+ 전달용 데이터
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
  logger.info('Device', id, '센서 조회 시작');
  client.setID(Number(id));
  readSensors(id);
};

function kickSensorReader() {

  // 등록된 AirQ 센서노드가 하나도 없는 경우 10초 기다린 후 다시 조회함.
  var numDev = devIds.length;
  if (!numDev) {
    setTimeout(kickSensorReader, 10 * 1000);
    return;
  }

  fs.readFile('/proc/meminfo', 'utf8', function(err, data) {
    if (err) {
      return;
    }
    var lines = data.split('\n');
    var filteredLines = lines.filter(function(item) {
      if (item.indexOf('MemFree:') === 0) {
        return 1;
      }
      return 0;
    });
    if (filteredLines.length !== 1) {
      return;
    }
    var line = filteredLines[0].replace(/[\s]+/g,' ');
    var words = line.split(' ');
    var freeMemory = Number(words[1]);
    sensorValues.number = {
      value: freeMemory,
      ts: (new Date()).getTime()
    };
  });

  logger.info('Device 개수:', numDev);
  logger.info((numDev * NODE_QUERY_MAX_TIME) + '초 후에 sensor read 재시작 예약됨.');
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


client.connectRTU(PORT_NAME, {baudrate: 9600}, init);