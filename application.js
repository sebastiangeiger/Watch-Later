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


App.VideosRoute = Ember.Route.extend({});


App.AuthorizationState = Ember.Object.extend({

  authCode: null,
  expirationDate: null,
  state: "needsAuthCode",

  init: function(){
    this._readFromLocalStorage();
    if(!this.get('authorizationGateway')){
      this.set('authorizationGateway', App.AuthorizationGateway.create());
    };
  },

  deauthorize: function(){
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
    // console.log("Set " +  key + " to " +  value);
    localStorage.setItem(key, value);
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _switchStates: function(object,changed){
    var newState = "needsAuthCode";
    if(object.get('accessToken') && object.get('refreshToken')){
      newState = 'fullyAuthorized';
    } else {
      newState = 'needsAuthCode';
    }
    object.set('state', newState);
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
  }.observes('expiresIn')

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


})();
