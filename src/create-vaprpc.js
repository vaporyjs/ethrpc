"use strict";

var createStore = require("redux").createStore;
var thunkSubscribeEnhancer = require("redux-thunk-subscribe");

var ensureLatestBlock = require("./block-management/ensure-latest-block");
var waitForNextBlocks = require("./block-management/wait-for-next-blocks");
var packageAndSubmitRawTransaction = require("./raw-transactions/package-and-submit-raw-transaction");
var packageAndSignRawTransaction = require("./raw-transactions/package-and-sign-raw-transaction");
var packageRawTransaction = require("./raw-transactions/package-raw-transaction");
var signRawTransaction = require("./raw-transactions/sign-raw-transaction");
var signRawTransactionWithKey = require("./raw-transactions/sign-raw-transaction-with-key");
var packageRequest = require("./encode-request/package-request");
var handleRPCError = require("./decode-response/handle-rpc-error");
var validateAndDefaultBlockNumber = require("./validate/validate-and-default-block-number");
var validateTransaction = require("./validate/validate-transaction");
var registerTransactionRelay = require("./transaction-relay/register-transaction-relay");
var unregisterTransactionRelay = require("./transaction-relay/unregister-transaction-relay");
var excludeFromTransactionRelay = require("./transaction-relay/exclude-from-transaction-relay");
var includeInTransactionRelay = require("./transaction-relay/include-in-transaction-relay");
var callOrSendTransaction = require("./transact/call-or-send-transaction");
var callContractFunction = require("./transact/call-contract-function");
var transact = require("./transact/transact");

var raw = require("./wrappers/raw");
var vap = require("./wrappers/vap");
var net_ = require("./wrappers/net");
var web3 = require("./wrappers/web3");
var personal = require("./wrappers/personal");
var shh = require("./wrappers/shh");
var miner = require("./wrappers/miner");
var sendVapor = require("./wrappers/send-vapor");
var publish = require("./wrappers/publish");
var bindDispatch = require("./wrappers/bind-dispatch");
var isUnlocked = require("./wrappers/is-unlocked");
var resendTransaction = require("./wrappers/resend-transaction");
var resendRawTransaction = require("./wrappers/resend-raw-transaction");

var isFunction = require("./utils/is-function");
var sha3 = require("./utils/sha3");
var setDebugOptions = require("./debug/set-debug-options");
var errors = require("./errors/codes");
var clearTransactions = require("./clear-transactions");
var resetState = require("./reset-state");
var connect = require("./connect");
var startBlockStream = require("./start-block-stream.js");
var internalState = require("./internal-state");
var constants = require("./constants");

var createVaprpc = function (reducer) {
  var store = createStore(reducer, thunkSubscribeEnhancer);
  var dispatch = store.dispatch;
  return {
    errors: errors,
    constants: constants,

    setDebugOptions: function (debugOptions) { return dispatch(setDebugOptions(debugOptions)); },

    connect: function (configuration, callback) { return dispatch(connect(configuration, callback)); },
    startBlockStream: function (startingBlockNumber) { return dispatch(startBlockStream(startingBlockNumber)); },
    clear: function () { return dispatch(clearTransactions()); },
    resetState: function () { return dispatch(resetState()); },

    // Redux store state-lookup wrappers
    getBlockStream: function () { return internalState.get("blockAndLogStreamer"); },
    getTransport: function () { return internalState.get("transporter"); },
    getConfiguration: function () { return store.getState().configuration; },
    getCoinbase: function () { return store.getState().coinbase; },
    getCurrentBlock: function () { return store.getState().currentBlock; },
    getDebugOptions: function () { return store.getState().debug; },
    getGasPrice: function () { return store.getState().gasPrice; },
    getHighestNonce: function () { return store.getState().highestNonce; },
    getNetworkID: function () { return store.getState().networkID; },
    getNoRelay: function () { return store.getState().noRelay; },
    getSubscriptions: function () { return store.getState().subscriptions; },
    getTransactions: function () { return store.getState().transactions; },

    registerTransactionRelay: function (relayer) { return dispatch(registerTransactionRelay(relayer)); },
    unregisterTransactionRelay: function (relayer) { return dispatch(unregisterTransactionRelay(relayer)); },
    excludeFromTransactionRelay: function (method) { return dispatch(excludeFromTransactionRelay(method)); },
    includeInTransactionRelay: function (method) { return dispatch(includeInTransactionRelay(method)); },

    /******************************
     * Vapory JSON-RPC bindings *
     ******************************/

    raw: function (cmd, params, callback) { return dispatch(raw(cmd, params, callback)); },

    vap: bindDispatch(dispatch, vap),
    net: bindDispatch(dispatch, net_),
    web3: bindDispatch(dispatch, web3),
    shh: bindDispatch(dispatch, shh),
    miner: bindDispatch(dispatch, miner),
    personal: bindDispatch(dispatch, personal),

    // web3_
    sha3: sha3,
    clientVersion: function (callback) { return dispatch(web3.clientVersion(null, callback)); },

    // net_
    listening: function (callback) { return dispatch(net_.listening(null, callback)); },
    peerCount: function (callback) { return dispatch(net_.peerCount(null, callback)); },
    version: function (callback) { return dispatch(net_.version(null, callback)); },
    netVersion: function (callback) { return this.version(callback); },

    // vap_
    accounts: function (callback) { return dispatch(vap.accounts(null, callback)); },
    blockNumber: function (callback) { return dispatch(vap.blockNumber(null, callback)); },
    call: function (transaction, blockNumber, callback) {
      if (isFunction(blockNumber)) {
        callback = blockNumber;
        blockNumber = null;
      }
      return dispatch(vap.call([transaction, validateAndDefaultBlockNumber(blockNumber)], callback));
    },
    coinbase: function (callback) { return dispatch(vap.coinbase(null, callback)); },
    // note: compileLLL, compileSerpent, and compileSolidity intentionally left out
    estimateGas: function (transaction, blockNumber, callback) {
      if (isFunction(blockNumber)) {
        callback = blockNumber;
        blockNumber = null;
      }
      return dispatch(vap.estimateGas([transaction, validateAndDefaultBlockNumber(blockNumber)], callback));
    },
    gasPrice: function (callback) { return dispatch(vap.gasPrice(null, callback)); },
    getBalance: function (address, blockNumber, callback) {
      if (isFunction(blockNumber)) {
        callback = blockNumber;
        blockNumber = null;
      }
      return dispatch(vap.getBalance([address, validateAndDefaultBlockNumber(blockNumber)], callback));
    },
    balance: function (address, blockNumber, callback) {
      return this.getBalance(address, blockNumber, callback);
    },
    getBlockByHash: function (hash, shouldReturnFullTransactions, callback) {
      if (shouldReturnFullTransactions === undefined) shouldReturnFullTransactions = true;
      return dispatch(vap.getBlockByHash([hash, Boolean(shouldReturnFullTransactions)], callback));
    },
    getBlockByNumber: function (number, shouldReturnFullTransactions, callback) {
      if (shouldReturnFullTransactions !== true) shouldReturnFullTransactions = false;
      return dispatch(vap.getBlockByNumber([validateAndDefaultBlockNumber(number), Boolean(shouldReturnFullTransactions)], callback));
    },
    getBlock: function (number, shouldReturnFullTransactions, callback) { return this.getBlockByNumber(number, shouldReturnFullTransactions, callback); },
    getCode: function (address, blockNumber, callback) { return dispatch(vap.getCode([address, validateAndDefaultBlockNumber(blockNumber)], callback)); },
    getFilterChanges: function (filter, callback) { return dispatch(vap.getFilterChanges([filter], callback)); },
    getFilterLogs: function (filter, callback) { return dispatch(vap.getFilterLogs(filter, callback)); },
    getLogs: function (filter, callback) { return dispatch(vap.getLogs(filter, callback)); },
    // TODO: add map lookup support (at the moment, this function doesn't support
    // map lookups due to rounding errors after 51-bits for JS numbers)
    getStorageAt: function (address, position, blockNumber, callback) { return dispatch(vap.getStorageAt([address, position, validateAndDefaultBlockNumber(blockNumber)], callback)); },
    getTransactionByHash: function (transactionHash, callback) { return dispatch(vap.getTransactionByHash([transactionHash], callback)); },
    getTransaction: function (transactionHash, callback) { return this.getTransactionByHash(transactionHash, callback); },
    getTransactionCount: function (address, callback) { return dispatch(vap.getTransactionCount([address, "latest"], callback)); },
    getPendingTransactionCount: function (address, callback) { return dispatch(vap.getTransactionCount([address, "pending"], callback)); },
    getTransactionReceipt: function (transactionHash, callback) { return dispatch(vap.getTransactionReceipt(transactionHash, callback)); },
    getUncleByBlockHashAndIndex: function (blockHash, index, callback) { return dispatch(vap.getUncleByBlockHashAndIndex([blockHash, index], callback)); },
    getUncleByBlockNumberAndIndex: function (blockNumber, index, callback) { return dispatch(vap.getUncleByBlockNumberAndIndex([validateAndDefaultBlockNumber(blockNumber), index], callback)); },
    getUncle: function (blockNumber, index, callback) { return this.getUncleByBlockNumberAndIndex(blockNumber, index, callback); },
    getUncleCountByBlockHash: function (blockHash, callback) { return dispatch(vap.getUncleCountByBlockHash([blockHash], callback)); },
    getUncleCountByBlockNumber: function (blockNumber, callback) { return dispatch(vap.getUncleCountByBlockNumber([validateAndDefaultBlockNumber(blockNumber)], callback)); },
    getUncleCount: function (blockNumber, callback) { return this.getUncleCountByBlockNumber(blockNumber, callback); },
    hashrate: function (callback) { return dispatch(vap.hashrate(null, callback)); },
    mining: function (callback) { return dispatch(vap.mining(null, callback)); },
    newBlockFilter: function (callback) { return dispatch(vap.newBlockFilter(null, callback)); },
    /**
     * @param {{fromBlock:number|string, toBlock:number|string, address:string, topics:string[], limit:number}} filterOptions
     */
    newFilter: function (filterOptions, callback) {
      filterOptions.fromBlock = validateAndDefaultBlockNumber(filterOptions.fromBlock);
      filterOptions.toBlock = validateAndDefaultBlockNumber(filterOptions.toBlock);
      return dispatch(vap.newFilter(filterOptions, callback));
    },
    newPendingTransactionFilter: function (callback) { return dispatch(vap.newPendingTransactionFilter(null, callback)); },
    protocolVersion: function (callback) { return dispatch(vap.protocolVersion(null, callback)); },
    /**
     * @param {string} signedTransaction - RLP encoded transaction signed with private key
     */
    sendRawTransaction: function (signedTransaction, callback) {
      // allow for malformed input
      if (/^[0-9a-fA-F]*$/.test(signedTransaction)) {
        signedTransaction = "0x" + signedTransaction;
      }
      if (!/^0x[0-9a-fA-F]*$/.test(signedTransaction)) {
        throw new Error("signedTransaction must be RLP encoded hex byte array encoded into a string");
      }
      return dispatch(vap.sendRawTransaction([signedTransaction], callback));
    },
    /**
     * @param {{from:string, to:string, gas:number, gasPrice:number, value:number, data:string, nonce:number}} transaction
     */
    sendTransaction: function (transaction, callback) {
      validateTransaction(transaction);
      return dispatch(vap.sendTransaction([transaction], callback));
    },
    sign: function (address, data, callback) { return dispatch(vap.sign([address, data], callback)); },
    signTransaction: function (transaction, callback) {
      validateTransaction(transaction);
      return dispatch(vap.signTransaction([transaction], callback));
    },
    subscribe: function (label, options, callback) {
      if (options === undefined) options = {};
      if (options === null) options = {};
      if (typeof options !== "object") throw new Error("options must be an object");
      return dispatch(vap.subscribe([label, options], callback));
    },
    subscribeLogs: function (options, callback) { return this.subscribe("logs", options, callback); },
    subscribeNewHeads: function (callback) { return this.subscribe("newHeads", null, callback); },
    subscribeNewPendingTransactions: function (callback) { return this.subscribe("newPendingTransactions", null, callback); },
    syncing: function (callback) { return dispatch(vap.syncing(null, callback)); },
    uninstallFilter: function (filter, callback) { return dispatch(vap.uninstallFilter([filter], callback)); },
    unsubscribe: function (label, callback) { return dispatch(vap.unsubscribe([label], callback)); },

    WsTransport: require("./transport/ws-transport"),

    /************************
     * Convenience wrappers *
     ************************/

    signRawTransaction: signRawTransaction,
    signRawTransactionWithKey: signRawTransactionWithKey,
    packageRawTransaction: packageRawTransaction,
    packageRequest: packageRequest,
    packageAndSubmitRawTransaction: function (payload, address, privateKeyOrSigner, accountType, callback) {
      return dispatch(packageAndSubmitRawTransaction(payload, address, privateKeyOrSigner, accountType, callback));
    },
    packageAndSignRawTransaction: function (payload, address, privateKeyOrSigner, accountType, callback) {
      return dispatch(packageAndSignRawTransaction(payload, address, privateKeyOrSigner, accountType, callback));
    },

    handleRPCError: handleRPCError,
    sendVapor: function (to, value, from, onSent, onSuccess, onFailed) { return dispatch(sendVapor(to, value, from, onSent, onSuccess, onFailed)); },
    publish: function (compiled, callback) { return dispatch(publish(compiled, callback)); },
    ensureLatestBlock: function (callback) { return dispatch(ensureLatestBlock(callback)); },
    isUnlocked: function (account, callback) { return dispatch(isUnlocked(account, callback)); },
    waitForNextBlocks: function (blocks, mine, callback) { return dispatch(waitForNextBlocks(blocks, mine, callback)); },
    resend: function (transaction, gasPrice, gasLimit, callback) { return dispatch(resendTransaction(transaction, gasPrice, gasLimit, callback)); },
    resendRawTransaction: function (transaction, privateKey, gasPrice, gasLimit, callback) { return dispatch(resendRawTransaction(transaction, privateKey, gasPrice, gasLimit, callback)); },

    callOrSendTransaction: function (payload, callback) { return dispatch(callOrSendTransaction(payload, callback)); },
    callContractFunction: function (payload, callback, wrapper, aux) { return dispatch(callContractFunction(payload, callback, wrapper, aux)); },
    transact: function (payload, privateKeyOrSigner, accountType, onSent, onSuccess, onFailed) { return dispatch(transact(payload, privateKeyOrSigner, accountType, onSent, onSuccess, onFailed)); },
  };
};

module.exports = createVaprpc;
