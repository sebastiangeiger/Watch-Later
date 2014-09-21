(function() {
"use strict";

window.App = Ember.Application.create();

App.Router.map(function() {
  this.resource('app', { path: '/' }, function(){
    this.resource('videos');
  });
  this.resource('authorize');
});


App.ApplicationRoute = Ember.Route.extend({
  model: function(){
    return App.AuthorizationState.create();
  },

  actions: {
    deauthorize: function(){
      this.modelFor('application').deauthorize();
      this.transitionTo('authorize');
    }
  }
});

App.ApplicationController = Ember.ObjectController.extend({
});


App.AppRoute = Ember.Route.extend({
  afterModel: function(model, transition){
    var appModel = this.modelFor('application');
    if(appModel.get('fullyAuthorized')){
      this.transitionTo('videos');
    } else if (appModel.get('needsAuthCode')) {
      this.transitionTo('authorize');
    }
  }
});


App.AuthorizeRoute = Ember.Route.extend({
  afterModel: function(model, transition){
    var appModel = this.modelFor('application');
    if(appModel.get('fullyAuthorized')){
      this.transitionTo('videos');
    } else if (appModel.get('needsAuthCode')) {
      this.transitionTo('authorize');
    }
  },
  actions: {
    openAuthWindow: function() {
      window.open("https://accounts.google.com/o/oauth2/auth?"+
                    "client_id="+window.clientId+
                    "&redirect_uri="+window.redirectUri+
                    "&scope=https://www.googleapis.com/auth/youtube&response_type=code", "Google", "height=600,width=400");
    },

    authorize: function(authToken){
      var _this = this;
      this.modelFor('application').authorize(authToken).then(
        function(){
          _this.transitionTo('videos');
        },
        function(error) {
          console.log(error)
        });
    }
  }
});


App.VideosRoute = Ember.Route.extend({
  model: function(){
    var state = this.modelFor('application');
    var connection = App.AuthorizedConnection.create({authorizationState: state});
    return App.VideoList.create({authorizedConnection: connection});
  }
});


// ====== Models ========= //
App.AuthorizationState = Ember.Object.extend({

  authCode: null,
  expirationDate: null,
  state: "needsAuthCode",

  init: function(){
    this._readFromLocalStorage();
    this._determineState();
    if(!this.get('authorizationGateway')){
      this.set('authorizationGateway', App.AuthorizationGateway.create());
    };
  },

  deauthorize: function(){
    this.setProperties({
      accessToken: null,
      refreshToken: null,
      expirationDate: null
    });
  },

  authorize: function(authToken){
    var _this = this;
    return this.get('authorizationGateway').
      authorize(authToken).
      then(function(payload){
        _this.setProperties({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          expiresIn: payload.expires_in
        });
      });
  },

  needsAuthCode: function(){
    return this.get('state') === 'needsAuthCode';
  }.property('state'),

  fullyAuthorized: function(){
    return this.get('state') === 'fullyAuthorized';
  }.property('state'),

  _localStorageObserver: function(object,changed){
    var key = "authorizationState."+changed;
    var value = object.get(changed);
    if(value){
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _determineState: function(){
    var newState = "needsAuthCode";
    if(this.get('accessToken') && this.get('refreshToken')){
      newState = 'fullyAuthorized';
    } else {
      newState = 'needsAuthCode';
    }
    this.set('state', newState);
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _readFromLocalStorage: function(){
    this.set('accessToken', localStorage["authorizationState.accessToken"]);
    this.set('refreshToken', localStorage["authorizationState.refreshToken"]);
    var expirationDate = localStorage["authorizationState.expirationDate"]
    if(expirationDate){
      this.set('expirationDate', expirationDate);
    }
  },

  _updateExpirationDate: function() {
    var expiresIn = this.get('expiresIn');
    if(expiresIn){
      expiresIn = parseInt(expiresIn, 10);
      var expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + 1000 * expiresIn)
      this.set('expirationDate',expirationDate);
      this.set('expiresIn',null); //expiresIn served its purpose
    }
  }.observes('expiresIn'),
});

App.AuthorizedConnection = Ember.Object.extend({
  getRequest: function(url){
    var accessToken = this.get('authorizationState').get('accessToken');
    url = url + "&access_token="+accessToken;
    return $.ajax(url)
  }
});


App.AuthorizationGateway = Ember.Object.extend({
  authorize: function(authToken){
    var _data = {
      code: authToken,
      client_id: window.clientId,
      client_secret: window.clientSecret,
      redirect_uri: window.redirectUri,
      grant_type: "authorization_code"
    };
    return new Ember.RSVP.Promise(function(resolve, reject) {
      if(!!authToken){
        resolve(authToken);
      } else {
        reject("authToken was " + String(authToken));
      }
    }).then(function(authToken){
      return $.ajax({
        type: "POST",
        url: "https://accounts.google.com/o/oauth2/token",
        data: _data,
        dataType: "text"
      })
    }).then(function(payload){
      console.log(payload);
      return JSON.parse(payload);
    });
  }
});

App.VideoList = Ember.Object.extend({
  watchLaterId: null,
  numberOfVideos: 0,
  rawVideos: [],

  init: function(){
    var api = App.YouTubeApi.create({connection: this.get("authorizedConnection")});
    this.set('youTubeApi', api)
    this.getVideos();
  },

  videos: function(){
    console.log(this.get('rawVideos')[0]);
    return this.get('rawVideos').reverse();
  }.property('rawVideos'),

  getVideos: function(){
    var storedVideos = localStorage.getItem('rawVideos');
    if(storedVideos){
      this.set('rawVideos', JSON.parse(storedVideos));
    } else {
      var _this = this;
      this.get('youTubeApi').getVideos().then(function(videos){
        _this.set('rawVideos', videos);
        localStorage.setItem('rawVideos', JSON.stringify(videos));
      });
    }
  }
});

App.YouTubeApi = Ember.Object.extend({

  getVideos: function(){
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve,reject){
      _this._getWatchLaterId().then(function(watchLaterId){
        _this._getAllPlayListItems(watchLaterId).then(function(videos){
          resolve(videos);
        });
      });
    })
  },

  _getWatchLaterId: function(){
    return this.get('connection').
      getRequest("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true").
      then(function(payload){
        return payload.items[0].contentDetails.relatedPlaylists.watchLater;
      });
  },

  _getAllPlayListItems: function(watchLaterId){
    //Recursivly goes through and gets all items depending on whether the
    //current data page points to a next page or not
    //If it points to a next page, then it will create a new Promise that
    //needs to be resolved first
    var _this = this;
    var recurse = function(watchLaterId,nextPageToken,items){
      items = items || [];
      return new Promise(function(resolve,reject){
        _this._getPlayListItems(watchLaterId,nextPageToken).then(function(data){
          var newItems = items.concat(data.items);
          if(data.nextPageToken){
            resolve(recurse(watchLaterId,data.nextPageToken,newItems));
          } else {
            resolve(newItems);
          }
        })
      });
    };
    return recurse(watchLaterId);
  },

  _getPlayListItems: function(watchLaterId,pageToken,maxResults){
    maxResults = maxResults || 50;
    var url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet"
    url += "&playlistId="+watchLaterId;
    url += "&maxResults="+maxResults;
    if(pageToken && pageToken !== "firstPage"){
      url += "&pageToken="+pageToken;
    }
    return this.get('connection').getRequest(url);
  }

});

})();
