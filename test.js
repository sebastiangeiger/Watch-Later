App.setupForTesting();
App.rootElement = '#ember-testing';

module('Unit: AuthorizationState',{
      setup: function(){
        localStorage.clear();
      },
      teardown: function(){
        localStorage.clear();
      }
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

test('state is initially "needsAuthCode"', function() {
  var state = App.AuthorizationState.create();
  equal(state.get('state'),'needsAuthCode');
});

test('state changes "fullyAuthorized" after authorization succeeded', function() {
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  state.set('authCode', 'the_auth_code');
  equal(state.get('state'),'needsAuthCode');
  Ember.run(function(){
    state.authorize("an_auth_token");
  });
  equal(state.get('state'),'fullyAuthorized');
});

test('the state is properly restored from localStorage', function(){
  localStorage.setItem("authorizationState.accessToken","stored_access_token");
  localStorage.setItem("authorizationState.refreshToken","stored_refresh_token");
  var the_date = new Date();
  localStorage.setItem("authorizationState.expirationDate", the_date);
  var state = App.AuthorizationState.create();
  equal(state.get('accessToken'), 'stored_access_token');
  equal(state.get('refreshToken'), 'stored_refresh_token');
  equal(state.get('expirationDate'), the_date);
});

test('deauthorize removes everything related to authorization', function(){
  localStorage.setItem("authorizationState.accessToken","stored_access_token");
  localStorage.setItem("authorizationState.refreshToken","stored_refresh_token");
  var the_date = new Date();
  localStorage.setItem("authorizationState.expirationDate", the_date);
  var state = App.AuthorizationState.create();
  state.deauthorize();
  equal(state.get('accessToken'), undefined);
  equal(state.get('refreshToken'), undefined);
  equal(state.get('expirationDate'), undefined);
  equal(state.get('state'),'needsAuthCode');
  equal(localStorage.getItem("authorizationState.accessToken"), undefined);
  equal(localStorage.getItem("authorizationState.refreshToken"), undefined);
  equal(localStorage.getItem("authorizationState.expirationDate"), undefined);
});

