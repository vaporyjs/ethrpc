global.speedomatic = require("@volut/speedomatic");
global.rpc = require("./src");
global.log = console.log;

var configuration = {
  httpAddresses: ["http://127.0.0.1:8545"],
  wsAddresses: ["ws://127.0.0.1:8546"],
  ipcAddresses: [],
  errorHandler: log
};

rpc.setDebugOptions({ connect: true });
rpc.connect(configuration, function (err) {
  if (err) return console.error("vaprpc connection failed:", err);
  rpc.vap.coinbase(function (err, coinbase) {
    if (err) return console.error("vap_coinbase failed");
    global.COINBASE = coinbase;
  });
  rpc.net.version(function (err, networkID) {
    if (err || networkID == null) return console.error("net_version failed");
    global.NETWORK_ID = networkID;
  });
});
