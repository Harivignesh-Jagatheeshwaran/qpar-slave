var libc = require("./libc.js");
var net = require("net");
var events = require("events");
var util = require("util");

function Connection(socket, port, host, auth, nanos2date, flipTables, emptyChar2null, long2number) {
  "use strict";
  events.EventEmitter.call(this);
  this.socket = socket;
  this.nanos2date = nanos2date;
  this.flipTables = flipTables;
  this.emptyChar2null = emptyChar2null;
  this.long2number = long2number;
  this.nextRequestNo = 1;
  this.nextResponseNo = 1;
  this.port = port;
  this.host = host;
  this.auth_parm = auth;
  var self = this;	
	this.socket.on("end", function() {
		self.emit("end");
	});
	this.socket.on("timeout", function() {
		self.emit("timeout");
	});
	this.socket.on("error", function(err) {
		self.emit("error", err);
	});
	this.socket.on("close", function(had_error) {
		self.emit("close", had_error);
	});
}
util.inherits(Connection, events.EventEmitter);

Connection.prototype.reconnect = function() {
   this.socket.connect(this.port, this.host);
   var p  = new Promise((resolve,reject)=> {
       this.auth(this.auth_parm, function() {
            const reqJSON = { x_fn        : "init_admin_handle"};
            global.gInstance.adminDBCon.rxds_exec(reqJSON).then(v=>{console.log(v); resolve(v);});
      });
    });
  return p;
}

Connection.prototype.listen = function() {
	"use strict";
	var self = this;
	this.chunk = new Buffer.alloc(0);
	this.socket.on("data", function(inbuffer) {
               // console.log("data coming in");
		var buffer,
			length, // current msg length
			o, // deserialized object
			err, // deserialize error
			responseNo;

		if (self.chunk.length !== 0) {
			buffer = new Buffer.alloc(self.chunk.length + inbuffer.length);
			self.chunk.copy(buffer);
			inbuffer.copy(buffer, self.chunk.length);
		} else {
			buffer = inbuffer;
		}
		while (buffer.length >= 8) {
			length = buffer.readUInt32LE(4);
			if (buffer.length >= length) {
				try {
					o = libc.deserialize(buffer, self.nanos2date, self.flipTables, self.emptyChar2null, self.long2number);
					err = undefined;
				} catch (e) {
				  console.log("Error deserialize "); console.log(e);
					o = null;
					err = e;
				}
				if (o && o.x_req) {
				  responseNo=o.x_req;o=o.res;
				}
				if (buffer.readUInt8(1) === 2) { // MsgType: 2 := response
				    //console.log(o);
//					if (!o.x_req) { responseNo = self.nextResponseNo;self.nextResponseNo += 1;}
              //  console.log("data coming in 1"+ responseNo);
                //console.log(o.x_req);
          if (o && o.x_wait && o.x_wait == "Yes") {
             console.log("backend asked to wait"); console.log(o);
          } else       
					      self.emit("response:" + responseNo, err, o);
				} else {
					if (err === undefined && Array.isArray(o) && o[0] === "upd") {
						events.EventEmitter.prototype.emit.apply(self, o);
					} else {
  //					if (!o.x_req) { responseNo = self.nextResponseNo;self.nextResponseNo += 1;}
               // console.log("data coming in 2 "  + responseNo);
                //console.log(o);
						self.emit("response:" + responseNo, err, o);
					}
				}
				if (buffer.length > length) {
					buffer = buffer.slice(length);
				} else {
					buffer = new Buffer.alloc(0);
				}
			} else {
				break;
			}
		}

		self.chunk = buffer;
	});
};
Connection.prototype.auth = function(auth, cb) {
	"use strict";
	var n = Buffer.byteLength(auth, "ascii"),
		b = new Buffer.alloc(n + 2),
		self = this;
	b.write(auth, 0, n, "ascii"); // auth (username:password)
	b.writeUInt8(0x3, n); // capability byte (compression, timestamp, timespan) http://code.kx.com/wiki/Reference/ipcprotocol#Handshake
	b.writeUInt8(0x0, n+1); // zero terminated
	this.socket.write(b);
	this.socket.once("data", function(buffer) {
		if (buffer.length === 1) {
			if (buffer[0] >= 1) { // capability byte must support at least (compression, timestamp, timespan) http://code.kx.com/wiki/Reference/ipcprotocol#Handshake
				self.listen();
				cb();
			} else {
				cb(new Error("Invalid capability byte from server"));
			}
		} else {
			cb(new Error("Invalid auth response from server"));
		}
	});
};

var sleep = function (ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}


Connection.prototype.rxds_exec= function(reqJSON) {
  var self = this, payload, b, requestNo = this.nextRequestNo;
  this.nextRequestNo += 1;
  reqJSON.x_req=requestNo;
  payload=["ipcexec",reqJSON];
//  console.log(payload);
  b = libc.serialize(payload);
  b.writeUInt8(0x1, 1); // MsgType: 1 := sync

  const p = new Promise((resolve, reject) => {
  try {
          this.socket.write(b, function() {
                  self.once("response:" + requestNo, function(err, o) {
                          if (err) reject(err); else resolve(o);});
          });
  } catch(e) { console.log("unable to connect to admin");
       global.poweroff(true);
       /* this.reconnect().then(
                v=>{this.socket.write(b, function() {
                        self.once("response:" + requestNo, function(err, o) {
                                if (err) reject(err); else resolve(o);});
                });}); */
        }
    });
  return p;
}//rxds_exec

Connection.prototype.k = function(s, cb) {
	"use strict";
	cb = arguments[arguments.length - 1];
	var self = this,
		payload,
		b,
		requestNo = this.nextRequestNo;
	this.nextRequestNo += 1;
	if (arguments.length === 1) {
		// Listen for async responses
		self.once("response:" + requestNo, function(err, o) {
			cb(err, o);
		});
	} else {
		if (arguments.length === 2) {
			payload = s;
		} else {
			payload = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
		}
                //console.log(payload);
		b = libc.serialize(payload);
		b.writeUInt8(0x1, 1); // MsgType: 1 := sync
                //b=Buffer.from(b);
                //b=payload;
		this.socket.write(b, function() {
			self.once("response:" + requestNo, function(err, o) {
				cb(err, o);
			});
		});
	}
};
Connection.prototype.ks = function(s, cb) {
	"use strict";
	cb = arguments[arguments.length - 1];
	var payload,
		b;
	if (arguments.length === 2) {
		payload = s;
	} else {
		payload = Array.prototype.slice.call(arguments, 0, arguments.length - 1);
	}
	b = libc.serialize(payload);
	this.socket.write(b, function() {
		cb();
	});
};
Connection.prototype.close = function(cb) {
	"use strict";
	this.socket.once("close", function() {
		if (cb) {
			cb();
		}
	});
	this.socket.end();
};

function connect(params, cb) {
	"use strict";
	var auth,
		errorcb,
		closecb,
		socket,
		error = false,
		close = false;
	if (typeof params !== "object") {
		params = {};
		if (arguments.length === 3) {
			params.host = arguments[0];
			params.port = arguments[1];
			cb = arguments[arguments.length -1];
		} else if (arguments.length === 5) {
			params.host = arguments[0];
			params.port = arguments[1];
			params.user = arguments[2];
			params.password = arguments[3];
			cb = arguments[arguments.length -1];
		} else {
			throw new Error("only three or five arguments allowed");
		}
	}
	if (params.user !== undefined) {
		auth = params.user + ":" + params.password;
	} else {
		auth = "anonymous";
	}
	errorcb = function(err) {
		error = true;
		cb(err);
	};
	closecb = function() {
		close = true;
		cb(new Error("Connection closes (wrong auth?)"));
	};
	socket = net.connect(params.port, params.host, function() {
		socket.removeListener("error", errorcb);
		if (error === false) {
			socket.once("close", closecb);
      var con = new Connection(socket, params.port, params.host, auth,
          params.nanos2date, params.flipTables, params.emptyChar2null, params.long2number);
			con.auth(auth, function() {
				socket.removeListener("close", closecb);
				if (close === false) {
					cb(undefined, con);
				}
			});
		}
	});
	if (params.socketTimeout !== undefined) {
		socket.setTimeout(params.socketTimeout);
	}
	if (params.socketNoDelay !== undefined) {
		socket.setNoDelay(params.socketNoDelay);
	}
	socket.once("error", errorcb);
}
exports.connect = connect;

