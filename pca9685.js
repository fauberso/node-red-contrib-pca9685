/**
 * Copyright 2016 Frederic Auberson <frederic@auberson.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/
 
// PCA9685 Node-RED node file
module.exports = function(RED) {
	const util = require('util')
	var i2cBus = require("i2c-bus");
	var Pca9685Driver = require("pca9685").Pca9685Driver;
	
// Set the pca9685 debug option from the environment variable
	var debugOption = false; 
	if (process.env.hasOwnProperty("RED_DEBUG") && process.env.RED_DEBUG.indexOf("pca9685") >= 0) {
		debugOption = true;
	}

    // The Server Definition - this opens (and closes) the connection
    function pca9685Node(config) {
        RED.nodes.createNode(this, config);

        // node configuration
	var deviceNumber = parseInt(config.deviceNumber);
        if (isNaN(deviceNumber)) {
            deviceNumber = 1;
        }
	    
        var options = {
            i2c: i2cBus.openSync(deviceNumber),
            address: parseInt(config.address) || 0x40,
            frequency: parseInt(config.frequency) || 50,
            debug: debugOption
        };

        this.pwm = new Pca9685Driver(options, function startLoop(err) {
            if (err) {
                console.error("Error initializing PCA9685");
             } else {
            	console.log("Initialized PCA9685");
            }
        });
     
        
        this.on("close", function() {
            if (this.pwm != null) {
            	this.pwm.dispose()
            }
        });
    }
    RED.nodes.registerType("PCA9685", pca9685Node);
	
    function pca9685OutputNode(config) {
        RED.nodes.createNode(this,config);
        this.pca9685 = config.pca9685;
        this.pca9685Node = RED.nodes.getNode(this.pca9685);
        this.pwm = this.pca9685Node.pwm;
        this.unit = config.unit;
        this.channel = config.channel;
        this.payload = config.payload;
        this.onStep = config.onStep;
        var node = this;
        var channelPowerState = Array(16).fill(false);

		this.on("input", function(msg, send, done) {
            done = done || function (err) { if (err) { node.error(err, msg) } };
			var unit = msg.unit || this.unit || "percent (assumed)";
			var channel = parseInt(msg.channel || this.channel || 0);
			var payload = parseInt(msg.payload || this.payload || 0);
			var onStep = parseInt(msg.onStep || this.onStep || 0);
            var power = parseInt(msg.power || 1);
			
			if (debugOption) {
                if (power !== 0) {
                    console.log("Set PCA9685 "+this.pwm+" Output "+channel+" to "+payload+" "+unit);
                } else {
                    console.log("Set PCA9685 "+channel+" to OFF");
                }
			}

            const setChannelPulse = (channel) => {
                const setPulse = (err) => {
                    if (err) {
                        return done(err);
                    }
                    if (unit == "microseconds") {
                        this.pwm.setPulseLength(channel, payload, onStep, done);
                    } else if (unit == "steps") {
                        this.pwm.setPulseRange(channel, onStep, payload, done);
                    } else {
                        this.pwm.setDutyCycle(channel, payload/100, onStep, done);
                    }
                }
                if (!channelPowerState[channel]) {
                    this.pwm.channelOn(channel, setPulse);
                    channelPowerState[channel] = true;
                } else {
                    setPulse();
                }
            }

            if (channel == 'all') {
                if (power !== 0) {
                    for (let i = 0; i < 16; i++) {
                        setChannelPulse(i);
                    }
                } else {
                    channelPowerState = Array(16).fill(false);
                    this.pwm.allChannelsOff(done);
                }
            } else if (power !== 0) {
                setChannelPulse(channel)
            } else {
                channelPowerState[channel] = false;
                this.pwm.channelOff(channel, done);
            }
		});
    }
    RED.nodes.registerType("PCA9685 out",pca9685OutputNode);
}
 
