var AuthorizationState = Backbone.Model.extend({
  defaults: {
    authCode: null,
    accessToken: null,
    refreshToken: null,
    expiresOn: null,
    state: 0
  },

  initialize: function(){
    this.PossibleStates = {
      AUTH_CODE_NEEDED: 0,
      FULLY_AUTHORIZED: 1,
      ACCESS_TOKEN_EXPIRED: 2
    }
    this._loadFromLocalStorage();
    this.updateState();
    console.log("State is: " + this.get("state"));
  },

  _loadFromLocalStorage: function(){
    this.setAccessToken (localStorage["authorizationState.accessToken"]);
    this.setRefreshToken(localStorage["authorizationState.refreshToken"]);
    this._setExpiresOn  (parseInt(localStorage["authorizationState.expiresOn"],10));
  },

  updateState: function(){
    var newState;
    if(this.has("accessToken") && !this._isExpired()){
      newState = this.PossibleStates.FULLY_AUTHORIZED;
    } else if(this._isExpired() && this.has("refreshToken")) {
      newState = this.PossibleStates.ACCESS_TOKEN_EXPIRED;
    } else {
      newState = this.PossibleStates.AUTH_CODE_NEEDED;
    }
    this.set({state: newState});
  },

  _isExpired: function(){
    return Date.now() > this.get("expiresOn");
  },

  isFullyAuthorized: function(){
    return this.get("state") === this.PossibleStates.FULLY_AUTHORIZED;
  },

  whenFullyAuthorized: function(){
    var _this = this;
    return new Promise(function(resolve, reject){
      if(_this.isFullyAuthorized()){
        resolve();
      } else {
        _this.on("change:state", function(){
          if(_this.isFullyAuthorized()){
            resolve();
          }
        });
      }
    });
  },

  has: function(property){
    var value = this.get(property);
    return value !== undefined && value !== null;
  },

  needsAuthCode: function(){
    return this.get("state") === this.PossibleStates.AUTH_CODE_NEEDED;
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

  _setExpiresOn: function(newValue){
    this._protectedSet("expiresOn", newValue);
  },

  setExpiresIn: function(newValue){
    var timeSpanInMilliSeconds = (parseInt(newValue,10) * 1000);
    this._setExpiresOn(Date.now() + timeSpanInMilliSeconds);
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

  state.on("change:state", function(){
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
    if(state.needsAuthCode()){
      $("#authorization").show();
      $("#main").hide();
    } else {
      $("#authorization").hide();
      $("#main").show();
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
        state.setAccessToken(json.access_token);
        state.setRefreshToken(json.refresh_token);
        state.setExpiresIn(json.expires_in);
        state.updateState();
      },
      dataType: "text"
    });
  };

  function AuthorizedConnection(){
    var _getRequests = [];
    var _this = this;
    this.get = function(url){
      return state.whenFullyAuthorized().then(function(){
        url = _this._addAccessToken(url);
        return Promise.resolve($.ajax(url));
      });
    };

    this._addAccessToken = function(url){
      return url + "&access_token="+state.get("accessToken");
    }
  }

  this.getConnection = function(){
    return new AuthorizedConnection();
  }
}

function YoutubeApi(connection){
  var _this = this;

  this.getWatchLaterId = function(){
    return connection.
      get("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true").
      then(function(data){
        return data.items[0].contentDetails.relatedPlaylists.watchLater;
      });
  };

  this.getPlayListItems = function(watchLaterId,pageToken,maxResults){
    maxResults = maxResults || 50;
    var url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet"
    url += "&playlistId="+watchLaterId;
    url += "&maxResults="+maxResults
    if(pageToken && pageToken !== "firstPage"){
      url += "&pageToken="+pageToken;
    }
    return connection.get(url);
  };


  this.getAllPlayListItems = function(watchLaterId){
    //Recursivly goes through and gets all items depending on whether the
    //current data page points to a next page or not
    //If it points to a next page, then it will create a new Promise that
    //needs to be resolved first
    var recurse = function(watchLaterId,nextPageToken,items){
      items = items || [];
      return new Promise(function(resolve,reject){
        _this.getPlayListItems(watchLaterId,nextPageToken).then(function(data){
          var newItems = items.concat(data.items);
          if(data.nextPageToken){
            resolve(recurse(watchLaterId,data.nextPageToken,newItems));
          } else {
            resolve(newItems);
          }
        })
      });
    };
    return recurse(watchLaterId);
  };

}

var Video = Backbone.Model.extend({
})
var Videos = Backbone.Collection.extend({
  model: Video
})


function Controller(youtubeApi){
  var _this = this;

  this.buildWatchLaterList = function(videos){
    youtubeApi.getWatchLaterId().then(youtubeApi.getAllPlayListItems).
      then(function(items){
        return _this.addItemsToCollection(items,videos);
      }).
      catch(function(error){
        console.error("FAILED", error.stack);
      });
  };

  this.addItemsToCollection = function(items,videos){
    items.forEach(function(item){
      if(item.kind === "youtube#playlistItem"){
        var snippet = item.snippet;
        var position = parseInt(snippet.position,10);
        var video = new Video({
          id: snippet.resourceId.videoId,
          title: snippet.title,
          description: snippet.description,
          position: position
        });
        videos.add(video, {at: position});
      } else {
        console.error("Don't know how to add this item:", item);
      }
    });
    return items;
  }
}

$(function(){
  var authorizationState = new AuthorizationState;
  var oauth = new OAuthHandler(authorizationState);
  oauth.injectOnPage();
  var youtube = new YoutubeApi(oauth.getConnection());
  var controller = new Controller(youtube);
  var videos = new Videos;
  videos.on("add", function(video){
    $("#titles").append("<li>"+video.get("position")+": "+video.get("title")+"</li>");
  });
  controller.buildWatchLaterList(videos);
});
