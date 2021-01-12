"use strict";

var assign = require("lodash.assign");
var vap_gasPrice = require("../wrappers/vap").gasPrice;
var RPCError = require("../errors/rpc-error");
var errors = require("../errors/codes");

/**
 * Set the gas price for a raw transaction.
 * @param {Object} packaged Packaged transaction.
 * @param {function} callback Callback function.
 * @return {Object|void} Packaged transaction with gasPrice set.
 */
var setRawTransactionGasPrice = function (packaged, callback) {
  return function (dispatch) {
    if (packaged.gasPrice != null) return callback(null, packaged);
    dispatch(vap_gasPrice(null, function (err, gasPrice) {
      if (err || gasPrice == null) return callback(new RPCError(errors.TRANSACTION_FAILED));
      callback(null, assign({}, packaged, { gasPrice: gasPrice }));
    }));
  };
};

module.exports = setRawTransactionGasPrice;
