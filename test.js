App.setupForTesting();
App.rootElement = '#ember-testing';

module('Unit: AuthorizationState');

test('isAuthorized initially returns false', function() {
  var authorizationState = App.AuthorizationState.create();
  equal(authorizationState.get('isAuthorized'), false);
});

test('authorize sets the accessToken', function() {
  var gateway = {
    authorize: function(){
      return new Ember.RSVP.Promise(function(resolve){
        resolve({
          access_token: 'the_access_token'
        })
      });
    }
  }
  var state = App.AuthorizationState.create({authorizationGateway: gateway});
  equal(state.get('accessToken'), undefined);
  Ember.run(function(){
    state.authorize("an_auth_token");
  });
  equal(state.get('accessToken'), 'the_access_token');
});
