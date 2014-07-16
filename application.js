function OAuth2(){
  var _authWindow;
  var _authCode;
  var _clientId = "XXX";
  var _clientSecret = "XXX";
  var _redirectUri = "urn:ietf:wg:oauth:2.0:oob";
  var _this = this;

  this.injectOnPage = function(){
    this.updateUiState();
    $("#startAuth").on("click", function(){
      _this.startAuth();
    });
  };

  this.isAuthorized = function(){
    var a = _authCode;
    var b = !(_authCode === undefined);
    var c = _accessToken;
    var d = !(_accessToken === undefined);
    return a && b && c && d;
  };

  this.updateUiState = function(){
    if(_this.isAuthorized()){
      $("#authorization").hide();
      $("#main").show();
      $("#main #info").append("_authCode: " + _authCode + " _accessToken: " + _accessToken);
    } else {
      $("#authorization").show();
      $("#main").hide();
    }
  };


  this.startAuth = function(){
    _authWindow = window.open("XXX", "Google", "height=600,width=400");
    _this.listenForAuthCode();
  };

  this.listenForAuthCode = function(){
    $("form#authCode input:submit").removeAttr("disabled");
    $("form#authCode").on("submit", function(event){
      event.preventDefault();
      _authCode = $(this).find("input:text").val();
      localStorage["auth_code"] = _authCode;
      _this.getRefreshAndAccessTokens();
      return false;
    });
  };

  this.getRefreshAndAccessTokens = function(){
    var _data = {
      code: _authCode,
      client_id: _clientId,
      client_secret: _clientSecret,
      redirect_uri: _redirectUri,
      grant_type: "authorization_code"
    };
    $.ajax({
      type: "POST",
      url: "https://accounts.google.com/o/oauth2/token",
      data: _data,
      success: function(data){
        _accessToken = JSON.parse(data).access_token;
        localStorage["access_token"] = _accessToken;
        _this.updateUiState();
      },
      dataType: "text"
    });
  };

}

$(function(){
  var oauth = new OAuth2();
  oauth.injectOnPage();
});
