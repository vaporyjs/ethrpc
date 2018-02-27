"use strict";

var speedomatic = require("speedomatic");
var immutableDelete = require("immutable-delete");
var packageAndSubmitRawTransaction = require("../raw-transactions/package-and-submit-raw-transaction");
var callOrSendTransaction = require("../transact/call-or-send-transaction");
var verifyTxSubmitted = require("../transact/verify-tx-submitted");
var errors = require("../errors/codes");

/**
 * asynchronous / non-blocking transact:
 *  - call onSent when the transaction is broadcast to the network
 *  - call onSuccess when the transaction has REQUIRED_CONFIRMATIONS
 *  - call onFailed if the transaction fails
 */
function transactAsync(payload, callReturn, privateKeyOrSigner, accountType, onSent, onSuccess, onFailed) {
  return function (dispatch, getState) {
    var sendTransactionOrRawTransaction;
    if (privateKeyOrSigner == null) {
      sendTransactionOrRawTransaction = callOrSendTransaction;
    } else {
      sendTransactionOrRawTransaction = function (payload, callback) {
        return packageAndSubmitRawTransaction(payload, payload.from, privateKeyOrSigner, accountType, callback);
      };
    }
    payload.send = true;
    dispatch(sendTransactionOrRawTransaction(immutableDelete(payload, "returns"), function (txHash) {
      if (getState().debug.tx) console.log("txHash:", txHash);
      if (txHash == null) return onFailed(errors.NULL_RESPONSE);
      if (txHash.error) return onFailed(txHash);
      txHash = speedomatic.formatInt256(txHash);

      // send the transaction hash and return value back
      // to the client, using the onSent callback
      onSent({ hash: txHash, callReturn: callReturn });

      dispatch(verifyTxSubmitted(payload, txHash, callReturn, privateKeyOrSigner, accountType, onSent, onSuccess, onFailed, function (err) {
        if (err != null) {
          err.hash = txHash;
          return onFailed(err);
        }
      }));
    }));
  };
}

module.exports = transactAsync;
