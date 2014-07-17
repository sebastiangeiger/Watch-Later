var AuthorizationState = Backbone.Model.extend({
  defaults: {
    authCode: null,
    accessToken: null,
    refreshToken: null,
    expiresIn: null
  },

  initialize: function(){
    this.loadFromLocalStorage();
    if(!this.isAuthorized()) {
      console.log("need to authorize");
    }
  },

  loadFromLocalStorage: function(){
    this.setAccessToken (localStorage["authorizationState.accessToken"]);
    this.setRefreshToken(localStorage["authorizationState.refreshToken"]);
    this.setExpiresIn   (localStorage["authorizationState.expiresIn"]);
  },

  isAuthorized: function(){
    return this.get("accessToken") !== null
  },

  setAuthCode: function(newValue){
    if(newValue !== undefined){
      console.log("Setting auth code to " + newValue);
      this.set({authCode: newValue});
    }
  },

  setAccessToken: function(newValue){
    this._protectedSet("accessToken", newValue);
  },

  setRefreshToken: function(newValue){
    this._protectedSet("refreshToken", newValue);
  },

  setExpiresIn: function(newValue){
    this._protectedSet("expiresIn", newValue);
  },

  _protectedSet: function(attribute, newValue){
    if(newValue !== undefined){
      console.log("Setting "+attribute+" to " + newValue + "(also in localStorage)");
      this.set(attribute, newValue);
      localStorage["authorizationState."+attribute] = newValue;
    }
  }
});

function OAuthHandler(state) {
  var _clientId = "XXX";
  var _clientSecret = "XXX";
  var _redirectUri = "urn:ietf:wg:oauth:2.0:oob";
  var _this = this;

  state.on("change:accessToken", function(){
    _this.updateUiState();
  });

  state.on("change:authCode", function(event,newValue){
    if(newValue !== null){
      _this.getRefreshAndAccessTokens();
    }
  });

  this.injectOnPage = function(){
    this.updateUiState();
    $("#startAuth").on("click", function(){
      _this.startAuth();
    });
  };

  this.updateUiState = function(){
    if(state.isAuthorized()){
      $("#authorization").hide();
      $("#main").show();
    } else {
      $("#authorization").show();
      $("#main").hide();
    }
  };

  this.startAuth = function(){
    window.open("https://accounts.google.com/o/oauth2/auth?client_id="+_clientId+"&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=https://www.googleapis.com/auth/youtube&response_type=code", "Google", "height=600,width=400");
    this.listenForAuthCode();
  };

  this.listenForAuthCode = function(){
    $("form#authCode input:submit").removeAttr("disabled");
    $("form#authCode").on("submit", function(event){
      event.preventDefault();
      state.setAuthCode($(this).find("input:text").val());
      return false;
    });
  };

  this.getRefreshAndAccessTokens = function(){
    var _data = {
      code: state.get("authCode"),
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
        var json = JSON.parse(data);
        console.log(json);
        state.setAccessToken(json.access_token);
        state.setRefreshToken(json.refresh_token);
        state.setExpiresIn(json.expires_in);
      },
      dataType: "text"
    });
  };
}

// function YoutubeApi(){
//   var _watchLaterId;
//   var _this = this;
//
//   this.getLists = function(){
//     var request = Promise.resolve($.ajax("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true&access_token="+_accessToken));
//     request.then(function(data){
//       _watchLaterId = data.items[0].contentDetails.relatedPlaylists.watchLater;
//       alert(_watchLaterId);
//       // _this.getWatchLaterContents();
//     });
//   };
//
//   this.getWatchLaterContents = function(){
//     $.ajax({
//       type: "GET",
//       url: "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId="+_watchLaterId+"&access_token="+_accessToken,
//       success: function(data){
//         var videos = data.items;
//         var titles = videos.map(function(video){
//           return video.snippet.title;
//         });
//         titles.forEach(function(title) {
//           $("#titles").append("<li>"+title+"</li>");
//         });
//       },
//       error: function(){
//         alert("ERROR!");
//       }
//     });
//   };
//
//
//
// }

$(function(){
  var authorizationState = new AuthorizationState;
  var oauth = new OAuthHandler(authorizationState);
  oauth.injectOnPage();
});
