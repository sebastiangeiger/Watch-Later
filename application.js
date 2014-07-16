function OAuth2(){
  var _authWindow;
  var _authCode;
  var _clientId = "XXX";
  var _clientSecret = "XXX";
  var _redirectUri = "urn:ietf:wg:oauth:2.0:oob";
  var _this = this;

  this.startAuth = function(){
    _authWindow = window.open("XXX", "Google", "height=600,width=400");
    _this.listenForAuthCode();
  };

  this.listenForAuthCode = function(){
    $("form#authCode input:submit").removeAttr("disabled");
    $("form#authCode").on("submit", function(event){
      _authCode = $(this).find("input:text").val();
      event.preventDefault();
      _this.authCodeSet();
      return false;
    });
  };

  this.authCodeSet = function(){
    $("#authorization").hide();
    _this.getRefreshAndAccessTokens();
  };

  this.getRefreshAndAccessTokens = function(){
    var _data = {
      code: _authCode,
      client_id: _clientId,
      client_secret: _clientSecret,
      redirect_uri: _redirectUri,
      grant_type: "authorization_code"
    };
    console.log("Posting with " + _authCode);
    $.ajax({
      type: "POST",
      url: "https://accounts.google.com/o/oauth2/token",
      data: _data,
      success: function(data){console.log(data);},
      dataType: "text"
    });
  };

}

$(function(){
  var oauth = new OAuth2();
  $("#startAuth").on("click", function(){
    oauth.startAuth();
  });
});
