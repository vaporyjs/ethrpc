"use strict";

var vap = require("../wrappers/vap");
var packageRequest = require("../encode-request/package-request");
var isObject = require("../utils/is-object");
var errors = require("../errors/codes");
var RPCError = require("../errors/rpc-error");

function callOrSendTransaction(payload, callback) {
  return function (dispatch, getState) {
    if (!isObject(payload)) return callback(new RPCError(errors.TRANSACTION_FAILED));
    try {
      var packaged = packageRequest(payload);
    } catch (err) {
      return callback(err);
    }
    if (getState().debug.broadcast) console.log("packaged:", packaged);
    if (payload.estimateGas) {
      dispatch(vap.estimateGas(packaged, callback));
    } else if (payload.send) {
      dispatch(vap.sendTransaction(packaged, callback));
    } else {
      dispatch(vap.call([packaged, "latest"], callback));
    }
  };
}

module.exports = callOrSendTransaction;
