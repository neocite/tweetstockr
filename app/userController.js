'use strict';

var UserModel = require('./models/user');
var TradeModel = require('./models/trade');

var config = require('../config/config');

var TradeController = require('./tradeController');
var tradeController = new TradeController();

module.exports = function() {

  this.ranking = function(mainCallback){

    // Get all sells
    TradeModel.aggregate(
      { $match: { 'type' : 'Sell', active : true }},
      { $group: {
        _id: "$owner",
        balance: { $sum: { $multiply: [ "$price", "$amount" ] } }
      }},
      function (sellErr, sellRes) {
        if (sellErr)
          return console.log(sellErr);

        // Get all purchases
        TradeModel.aggregate(
          { $match: { 'type' : 'Buy', active : true }},
          { $group: {
            _id: "$owner",
            balance: { $sum: { $multiply: [ "$price", "$amount", -1 ] } }
          }},
          function (buyErr, buyRes) {
            if (buyErr)
              return console.log(buyErr);

            // Join purchases with sells
            var transactionsSum = sellRes.concat(buyRes);

            // Group purchases and sells (sells - purchases)
            // Sort results by balance
            // Get Top results
            var result = transactionsSum.reduce(function(res, obj) {
                if (!(obj._id in res))
                    res.__array.push(res[obj._id] = obj);
                else
                    res[obj._id].balance += obj.balance;
                return res;
            }, {__array:[]}).__array
              .sort(function(a,b) { return b.balance - a.balance; })
              .slice(0, config.usersOnRanking);

            // Fetch users data (async loop)
            var asyncLoop = function(o){
                var i=-1;
                var loop = function(){
                    i++;
                    if(i==o.length){o.callback(); return;}
                    o.functionToLoop(loop, i);
                }
                loop();//init
            }
            asyncLoop({
                length : result.length,
                functionToLoop : function(loop, i){
                  UserModel.findById(result[i]._id, function(err, userDoc){
                    delete result[i]._id;
                    result[i].user = userDoc;
                    loop();
                  });
                },
                callback : function(){
                    mainCallback(result);
                }
            });

        });

      });

  };

  this.rankingPosition = function(user, mainCallback){

    // Get all sells
    TradeModel.aggregate(
      { $match: { 'type' : 'Sell', active : true }},
      { $group: {
        _id: "$owner",
        balance: { $sum: { $multiply: [ "$price", "$amount" ] } }
      }},
      function (sellErr, sellRes) {
        if (sellErr)
          return console.log(sellErr);

        // Get all purchases
        TradeModel.aggregate(
          { $match: { 'type' : 'Buy', active : true }},
          { $group: {
            _id: "$owner",
            balance: { $sum: { $multiply: [ "$price", "$amount", -1 ] } }
          }},
          function (buyErr, buyRes) {
            if (buyErr)
              return console.log(buyErr);

            // Join purchases with sells
            var transactionsSum = sellRes.concat(buyRes);

            // Group purchases and sells (sells - purchases)
            // Sort results by balance
            var result = transactionsSum.reduce(function(res, obj) {
                if (!(obj._id in res))
                    res.__array.push(res[obj._id] = obj);
                else
                    res[obj._id].balance += obj.balance;
                return res;
            }, {__array:[]}).__array
              .sort(function(a,b) { return b.balance - a.balance; });

            // Get user position
            var position = null;
            for (var i = 0; i < result.length; i++) {
                 if (result[i]._id.equals(user._id)) {
                    position = i+1;
                    break;
                 }
             }
             mainCallback(position);

        });

      });

  };

  this.portfolio = function(user, callback){

    var portfolioArray = [];

    TradeModel.find({ 'owner' : user, 'type' : 'Buy', active : true }, function(err, trades) {

      var itemsProcessed = 0;
      trades.forEach((trade, index, array) => {

          findStockPrice(trade, function(portfolioItem){

            portfolioArray.push(portfolioItem);
            itemsProcessed++;
            if(itemsProcessed === trades.length)
              callback(portfolioArray);

          });

      });

    });

    var findStockPrice = function(trade, callback){

      tradeController.findStockHistory(trade.stock, function(history){

        var portfolioItem = {
          'tradeId' : trade._id,
          'stock' : trade.stock,
          'amount' : trade.amount,
          'purchasePrice' : trade.price,
          'currentPrice' : history[0].price || 0,
          'created' : trade.created,
          'history' : history
        };
        callback(portfolioItem);

      });

    };

  };

  this.stats = function(user, callback){

    var thisController = this;
    tradeController.totalSells(user, function(totalSell){
        tradeController.totalPurchases(user, function(totalBuy){
              callback({
                'totalSells': totalSell,
                'totalPurchases': totalBuy
              });
          });
      });

  };

  this.statement = function(user, callback){

    TradeModel.find({ 'owner' : user }, function(err, trades) {
      callback(trades);
    });

  };

  this.restart = function(user, mainCallback){

    // Need to get user again so it will not be affected by manipulated requests
    UserModel.findOne({ '_id' : user._id }, function(err, docUser){

      if (err)
        return mainCallback({ success: false, message: err });

      if (!docUser)
        return mainCallback({ success: false, message: 'User not found' });

      removeTrades(docUser, processReset);
    });


    var removeTrades = function(docUser, callback){
        TradeModel.remove({ 'owner' : docUser }, function(){
          callback(docUser);
        });
    }

    var processReset = function(docUser){

      // Trades removed. Add reset trade.
      var trade = new TradeModel({
        stock: '_RESET',
        price: config.startingPoints,
        amount: 1,
        owner: docUser,
        type: 'Sell',
      });

      trade.save(function(err) {
        if (err)
          return mainCallback({ success: false, message: err });

        return mainCallback({
          success: true,
          message: 'You reset your account'
        });

      });

    }


  };

};
