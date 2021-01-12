"use strict";

var vap_sendRawTransaction = require("../wrappers/vap").sendRawTransaction;
var packageAndSignRawTransaction = require("./package-and-sign-raw-transaction");
var handleRawTransactionError = require("./handle-raw-transaction-error");
var RPCError = require("../errors/rpc-error");
var errors = require("../errors/codes");
var ACCOUNT_TYPES = require("../constants").ACCOUNT_TYPES;

/**
 * Package, sign, and submit a raw transaction to Vapory.
 * @param {Object} payload Static ABI data with the "params" and "from" fields set.
 * @param {string} address The sender's Vapory address.
 * @param {buffer|function} privateKeyOrSigner Sender's plaintext private key or signing function.
 * @param {string} accountType One of "privateKey", "uPort", or "ledger".
 * @param {function} callback Callback function.
 * @return {string|void} Transaction hash (if successful).
 */
function packageAndSubmitRawTransaction(payload, address, privateKeyOrSigner, accountType, callback) {
  return function (dispatch, getState) {
    dispatch(packageAndSignRawTransaction(payload, address, privateKeyOrSigner, accountType, function (err, signedRawTransaction) {
      if (err) return callback(err);
      function handleRawTransactionResponse(err, rawTransactionResponse) {
        if (getState().debug.broadcast) console.log("[vaprpc] sendRawTransaction response:", rawTransactionResponse);
        if (err) {
          var handledError = handleRawTransactionError(err);
          if (handledError != null) return callback(handledError);
          dispatch(packageAndSubmitRawTransaction(payload, address, privateKeyOrSigner, accountType, callback));
        } else if (rawTransactionResponse == null) {
          callback(new RPCError(errors.RAW_TRANSACTION_ERROR));
        } else {
          callback(null, rawTransactionResponse);
        }
      }
      if (accountType === ACCOUNT_TYPES.U_PORT) { // signedRawTransaction is transaction hash for uPort
        handleRawTransactionResponse(null, signedRawTransaction);
      } else {
        dispatch(vap_sendRawTransaction(signedRawTransaction, handleRawTransactionResponse));
      }
    }));
  };
}

module.exports = packageAndSubmitRawTransaction;
