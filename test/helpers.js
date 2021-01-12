"use strict";

var assert = require("chai").assert;
var os = require("os");
var StubServer = require("vaporyjs-stub-rpc-server");
var rpc = require("../src");

function errorHandler(err) {
  assert.isTrue(false, (err || {}).message || err);
}

module.exports.getIpcAddress = function () {
  return process.env.VAPRPC_TEST_IPC_ADDRESS || ((os.type() === "Windows_NT") ? "\\\\.\\pipe\\TestRPC" : "testrpc.ipc");
};

module.exports.getWsAddress = function () {
  return process.env.VAPRPC_TEST_WS_ADDRESS || "ws://localhost:1337";
};

module.exports.getHttpAddress = function () {
  return process.env.VAPRPC_TEST_HTTP_ADDRESS || "http://localhost:1337";
};

module.exports.rpcConnect = function (transportType, transportAddress, callback) {
  var configuration = this.getRpcConfiguration(transportType, transportAddress);
  rpc.connect(configuration, function (err) {
    assert.isNull(err, (err || {}).message);
    callback(null);
  });
};

module.exports.getRpcConfiguration = function (transportType, transportAddress) {
  switch (transportType) {
    case "IPC":
      return {
        ipcAddresses: [transportAddress],
        wsAddresses: [],
        httpAddresses: [],
        pollingIntervalMilliseconds: 1,
        blockRetention: 5,
        errorHandler: errorHandler,
      };
    case "WS":
      return {
        ipcAddresses: [],
        wsAddresses: [transportAddress],
        httpAddresses: [],
        pollingIntervalMilliseconds: 1,
        blockRetention: 5,
        errorHandler: errorHandler,
      };
    case "HTTP":
      return {
        ipcAddresses: [],
        wsAddresses: [],
        httpAddresses: [transportAddress],
        pollingIntervalMilliseconds: 1,
        blockRetention: 5,
        errorHandler: errorHandler,
      };
    default:
      assert.isFalse(true, "Unknown transportType: " + transportType);
  }
};

module.exports.createStubRpcServerWithRequiredResponders = function (transportType, transportAddress) {
  var stubRpcServer = StubServer.createStubServer(transportType, transportAddress);
  stubRpcServer.addResponder(function (request) {
    switch (request.method) {
      case "vap_coinbase":
        return "0x0000000000000000000000000000000000000b0b";
      case "vap_gasPrice":
        return "0x09184e72a000";
      case "vap_subscribe":
        return "0x00000000000000000000000000000001";
      case "vap_unsubscribe":
        return true;
    }
  });
  return stubRpcServer;
};
