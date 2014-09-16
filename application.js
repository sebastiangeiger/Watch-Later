(function() {
"use strict";

window.App = Ember.Application.create();

App.Router.map(function() {
  this.resource('app', { path: '/' }, function(){
    this.resource('videos');
  });
  this.resource('authorize');
});

App.AppRoute = Ember.Route.extend({
  redirect: function(model, transition){
    if(!localStorage.auth_token){
      this.transitionTo('authorize');
    } else {
      this.transitionTo('videos');
    }
  },
  model: function() {
    return {text: "Hello"}
  }
});

App.AuthorizeRoute = Ember.Route.extend({
  actions: {
    openAuthWindow: function() {
      window.open("https://accounts.google.com/o/oauth2/auth?client_id="+window.clientId+"&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube&response_type=code", "Google", "height=600,width=400");
    },
    authorize: function(authToken){
      localStorage.auth_token = authToken
      this.transitionTo('videos');
    }
  }
});

App.VideosRoute = Ember.Route.extend();

})();

