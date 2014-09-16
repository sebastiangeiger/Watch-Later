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
  redirect: function(model, transition){
    if(this.modelFor('application').get('isAuthorized')){
      this.transitionTo('videos');
    } else {
      this.transitionTo('authorize');
    }
  }
});


App.AuthorizeRoute = Ember.Route.extend({
  actions: {
    openAuthWindow: function() {
      window.open("https://accounts.google.com/o/oauth2/auth?client_id="+window.clientId+"&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube&response_type=code", "Google", "height=600,width=400");
    },

    authorize: function(authToken){
      this.modelFor('application').authorize(authToken);
      this.transitionTo('videos');
    }
  }
});


App.VideosRoute = Ember.Route.extend({});


App.AuthorizationState = Ember.Object.extend({
  init: function(){
    this.set('authToken', localStorage.auth_token);
  },

  isAuthorized: function() {
    console.log("isAuthorized = " + !!this.get('authToken') + " (" + this.get('authToken') + ")");
    return !!this.get('authToken');
  }.property('authToken'),

  deauthorize: function(){
    delete localStorage.auth_token;
    this.set('authToken', localStorage.auth_token);
  },

  authorize: function(authToken){
    if(!!authToken){
      localStorage.auth_token = authToken
      this.set('authToken', localStorage.auth_token);
    } else {
      console.log("authorize failed");
    }
  }
});


})();
