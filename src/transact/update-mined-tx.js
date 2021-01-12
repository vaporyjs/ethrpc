"use strict";

var speedomatic = require("@volut/speedomatic");
var BigNumber = require("bignumber.js");
var vap = require("../wrappers/vap");
var isFunction = require("../utils/is-function");
var logError = require("../utils/log-error");
var errors = require("../errors/codes");
var RPCError = require("../errors/rpc-error");
var constants = require("../constants");

function updateMinedTx(txHash) {
  return function (dispatch, getState) {
    var state = getState();
    var debug = state.debug;
    var currentBlock = state.currentBlock;
    dispatch({
      type: "SET_TRANSACTION_CONFIRMATIONS",
      hash: txHash,
      currentBlockNumber: currentBlock.number,
    });
    var transaction = getState().transactions[txHash];
    var onFailed = isFunction(transaction.onFailed) ? transaction.onFailed : logError;
    if (transaction.confirmations >= constants.REQUIRED_CONFIRMATIONS) {
      dispatch({ type: "TRANSACTION_CONFIRMED", hash: txHash });
      dispatch(vap.getBlockByNumber([transaction.tx.blockNumber, false], function (err, block) {
        if (err) return onFailed(err);
        if (block == null) return onFailed(new RPCError(errors.BLOCK_NOT_FOUND));
        if (block.timestamp != null) {
          dispatch({
            type: "UPDATE_TRANSACTION",
            hash: txHash,
            data: { tx: { timestamp: parseInt(block.timestamp, 16) } },
          });
        }
        dispatch({
          type: "UPDATE_TRANSACTION",
          hash: txHash,
          data: { tx: { callReturn: transaction.tx.callReturn } },
        });
        dispatch(vap.getTransactionReceipt(txHash, function (err, receipt) {
          if (debug.tx) console.log("[vaprpc] got receipt:", err, receipt);
          if (err) return onFailed(err);
          if (receipt == null) return onFailed(new RPCError(errors.TRANSACTION_RECEIPT_NOT_FOUND));
          if (receipt.gasUsed) {
            dispatch({
              type: "UPDATE_TRANSACTION",
              hash: txHash,
              data: {
                tx: {
                  gasFees: speedomatic.unfix(new BigNumber(receipt.gasUsed, 16).times(new BigNumber(transaction.tx.gasPrice, 16)), "string"),
                },
              },
            });
          }
          dispatch({ type: "UNLOCK_TRANSACTION", hash: txHash });
          if (receipt.status != null) {
            if (parseInt(receipt.status, 16) === 0) {
              onFailed(getState().transactions[txHash].tx);
            } else if (parseInt(receipt.status, 16) === 1) {
              transaction.onSuccess(getState().transactions[txHash].tx);
            }
          } else {
            transaction.onSuccess(getState().transactions[txHash].tx);
          }
        }));
      }));
    } else {
      dispatch({ type: "UNLOCK_TRANSACTION", hash: transaction.hash });
    }
  };
}

module.exports = updateMinedTx;
