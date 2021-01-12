"use strict";

var BigNumber = require("bignumber.js");
var vap_getTransactionReceipt = require("../wrappers/vap").getTransactionReceipt;
var errors = require("../errors/codes");
var RPCError = require("../errors/rpc-error");

function getLoggedReturnValue(txHash, callback) {
  return function (dispatch, getState) {
    dispatch(vap_getTransactionReceipt(txHash, function (err, receipt) {
      if (getState().debug.tx) console.log("got receipt:", receipt);
      if (err) return callback(err);
      if (!receipt || !Array.isArray(receipt.logs) || !receipt.logs.length) return callback(new RPCError(errors.NULL_CALL_RETURN));
      var log = receipt.logs[receipt.logs.length - 1];
      if (!log || log.data == null) return callback(new RPCError(errors.NULL_CALL_RETURN));
      callback(null, { returnValue: log.data, gasUsed: new BigNumber(receipt.gasUsed, 16) });
    }));
  };
}

module.exports = getLoggedReturnValue;
