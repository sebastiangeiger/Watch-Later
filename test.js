App.setupForTesting();
App.rootElement = '#ember-testing';

module('Unit: AuthorizationState');

test('isAuthorized initially returns false', function() {
  var authorizationState = App.AuthorizationState.create();
  equal(authorizationState.get('isAuthorized'), false);
});
