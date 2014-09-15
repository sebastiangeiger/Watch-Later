(function() {
"use strict";

window.App = Ember.Application.create();

App.Router.map(function() {
  this.resource('app', { path: '/' });
});

App.AppRoute = Ember.Route.extend({
  model: function() {
    return {text: "Hello"}
  }
});

})();

