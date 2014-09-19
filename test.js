App.setupForTesting();
App.rootElement = '#ember-testing';

module('Unit: AuthorizationState');

test('isAuthorized initially returns false', function() {
  var authorizationState = App.AuthorizationState.create();
  equal(authorizationState.get('isAuthorized'), false);
});


var gateway = {
  authorize: function(){
    return new Ember.RSVP.Promise(function(resolve){
      resolve({
        "access_token" : "the_access_token",
        "token_type" : "Bearer",
        "expires_in" : 3600,
        "refresh_token" : "the_refresh_token"
      })
    });
  }
}

var isClose = function(a,b,delta){
  return Math.abs(a-b) < delta
}

test('authorize sets the accessToken', function() {
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  equal(state.get('accessToken'), undefined);
  Ember.run(function(){
    state.authorize("an_auth_token");
  });
  equal(state.get('accessToken'), 'the_access_token');
});

test('authorize sets the refreshToken', function() {
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  equal(state.get('refreshToken'), undefined);
  Ember.run(function(){
    state.authorize("an_auth_token");
  });
  equal(state.get('refreshToken'), 'the_refresh_token');
});

test('authorize sets the expirationDate', function() {
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  equal(state.get('expirationDate'), null);
  Ember.run(function(){
    state.authorize("an_auth_token");
  });
  var in1Hour = new Date().getTime() + 3600 * 1000;
  ok(isClose(state.get('expirationDate').getTime(), in1Hour, 2));
});

test('setting expiresIn sets expirationDate', function(){
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  state.set('expiresIn', '3600');
  var in1Hour = new Date().getTime() + 3600 * 1000;
  ok(isClose(state.get('expirationDate').getTime(), in1Hour, 2));
});

test('setting expiresIn sets it back to null afterwards', function(){
  //It is only used to set expirationDate
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  state.set('expiresIn', '3600');
  equal(state.get('expiresIn'), null);
});
