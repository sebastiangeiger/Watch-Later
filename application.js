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
    if(this.modelFor('application').get('isAuthorized')){
      this.transitionTo('videos');
    } else {
      this.transitionTo('authorize');
    }
  }
});


App.AuthorizeRoute = Ember.Route.extend({
  afterModel: function(model, transition){
    if(this.modelFor('application').get('isAuthorized')){
      this.transitionTo('videos');
    } else {
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
  init: function(){
    this.set('authToken', null);
    this.get('expiresIn');
    this.get('expirationDate');
  },

  isAuthorized: function() {
    return false;
  }.property(),

  expirationDate: function() {
    var temp = new Date();
    var expiresIn = parseInt(this.get('expiresIn'), 10);
    temp.setTime(temp.getTime() + 1000 * expiresIn)
    return temp
  }.property('expiresIn'),

  deauthorize: function(){
  },

  authorize: function(authToken){
    var _this = this;
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
      payload = JSON.parse(payload);
      _this.setProperties({
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        expiresIn: payload.expires_in
      })
    });
  },

  _localStorageObserver: function(object,changed){
    var key = "authorizationState."+changed;
    var value = object.get(changed);
    console.log("Set " +  key + " to " +  value);
    localStorage.setItem(key, value);
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _moreObserver: function(object,changed){
    var value = object.get(changed);
    console.log(changed + " changed to " +  value);
  }.observes('accessToken', 'refreshToken', 'expirationDate')


});


})();
