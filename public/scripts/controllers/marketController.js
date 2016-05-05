(function() {
  'use strict';

  angular
    .module('tweetstockr')
    .controller('marketController', marketController);

  function marketController ($rootScope, $scope, portfolioService, networkService, marketService, CONFIG, Notification, $timeout, $interval) {

    socket.emit('requestRound');
    $scope.loading = true;
    $scope.responseReceived = false;

    socket.on('receiveRound',function(data){
      $scope.loading = false;
      $scope.stocks = data.stocks;
      $scope.nextUpdateIn = data.nextUpdateIn;
      $scope.lastUpdate = data.lastUpdate;
      $scope.nextUpdate = data.nextUpdate;
      $scope.roundDuration = data.roundDuration;
      initializeClock(data.lastUpdate);


      // var formattedStocks = data.stocks;

      // for (var i = 0; i < formattedStocks.length; i++) {
        // var stock = formattedStocks[i];
        // var dataLenght = stock.history.length;
        //
        // if (stock.price > 0 && dataLenght > 1) {
        //   if (stock.history[1].price > 0) {
        //     var variationNumber = (( stock.price / stock.history[1].price ) - 1) * 100;
        //     stock.variation = Math.round(variationNumber).toFixed(0) + '%';
        //     stock.lastMove = (variationNumber < 0) ? 'danger' : 'success';
        //     stock.icon = (variationNumber < 0) ? 'fa-caret-down' : 'fa-caret-up';
        //   }
        // }

        // var chartData = {};
        // chartData.labels = [];
        // chartData.series = [[]];

        // for (var j = dataLenght-1; j >= 0; j--) {
        //   var time = new Date(stock.history[j].created_at);
        //   var label = time.getHours() + ':' + time.getMinutes();
        //
        //   chartData.series[0].push(stock.history[j].price);
        //   chartData.labels.push(label);
        // }

        // stock.chartData = chartData;
      // }
      $scope.responseReceived = true;
    });


    // Update Countdown ========================================================
    function getTimeRemaining(endtime) {
      var t = Date.parse(endtime) - Date.parse(new Date());
      var seconds = Math.floor((t / 1000) % 60);
      var minutes = Math.floor((t / 1000 / 60) % 60);
      var hours = Math.floor((t / (1000 * 60 * 60)) % 24);
      var days = Math.floor(t / (1000 * 60 * 60 * 24));
      return {
        'total': t,
        'days': days,
        'hours': hours,
        'minutes': minutes,
        'seconds': seconds
      };
    }

    function initializeClock(endtime) {
      function updateClock() {
        var t = getTimeRemaining(endtime);

        if (t.total > 0) {
          var timeString = ('0' + t.minutes).slice(-2) + ':' + ('0' + t.seconds).slice(-2);
          $timeout(function() {
            $scope.nextUpdateIn = timeString;
            $scope.nextUpdatePerc = (t.total / $scope.roundDuration) * 100;
          });
        } else {
          $timeout(function() {
            $scope.nextUpdateIn = '00:00';
            $scope.nextUpdatePerc = 0;
          });
          clearInterval(timeinterval);
        }
      }

      updateClock();
      var timeinterval = setInterval(updateClock, 1000);
    }

    // Game loop ===============================================================

    $scope.chartOptions = {
      showArea: true
    }

    $scope.currentTab = 'SHARES';

    $scope.onClickTab = function (tab) {
      $scope.currentTab = tab;
    };

    $scope.isActiveTab = function (tab) {
      return $scope.currentTab === tab;
    };

    $scope.sellShare = function(share) {
      $scope.stockBtn = true;

      marketService.sell(share.tradeId,
        function successCallback(response) {
          var audio = document.getElementById('audio2');
          audio.play();
          $scope.getPortfolio();
          Notification.success(response.message);
        },
        function errorCallback(response) {
          Notification.error(response.message);
        }
      );
    };

    $scope.buyShare = function(name, quantity) {
      $scope.stockBtn = true;

      marketService.buy(name, quantity,
        function successCallback(response) {
          Notification.success(response);
          var audio = document.getElementById('audio');
          audio.play();
          $scope.getPortfolio();
        },
        function errorCallback(response) {
          Notification.error(response.message);
        }
      );
    };

    $scope.getPortfolio = function () {
      portfolioService.getPortfolio(
        function onSuccess(data) {
          $scope.portfolio = data;

          for (var i = 0; i < $scope.portfolio.length; i++) {
            var portfolio = $scope.portfolio[i];
            // var dataLenght = portfolio.history.length;
            var chartData = {};
            chartData.labels = [];
            chartData.series = [[]];
            //
            // for (var j = dataLenght-1; j >= 0; j--) {
            //   var time = new Date(portfolio.history[j].created_at);
            //   var label = time.getHours() + ':' + time.getMinutes();
            //
            //   chartData.series[0].push(portfolio.history[j].price);
            //   chartData.labels.push(label);
            // }

            portfolio.chartData = chartData;
          }

          $scope.responseReceived = true;
          $scope.loading = true;
          $scope.stockBtn = false;
        },
        function onError(data) {
          Notification.error(data.message);
          console.log('Portfolio Error: ' + data.message);
        }
      );
    };
  }
})();
