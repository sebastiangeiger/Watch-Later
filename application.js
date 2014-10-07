(function() {
$(document).keypress(function(e) {
  var noop = function(){};
  Ember.Instrumentation.instrument("globalKeys.keyPressed", e.which, noop);
});

window.App = Ember.Application.create({
  LOG_TRANSITIONS: true,
  LOG_TRANSITIONS_INTERNAL: true,
  LOG_VIEW_LOOKUPS: true
});

window.developer_wants_to_keep_his_sanity = true;

App.Router.map(function() {
  this.resource('app', { path: '/' }, function(){
    this.resource('videos', function(){
      this.resource('video', { path: '/:video_id' });
    });
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
  lastKeyPressed: 'none'
})

App.AppRoute = Ember.Route.extend({
  model: function(){
    var state = this.modelFor('application');
    var connection = App.AuthorizedConnection.create({authorizationState: state});
    return App.VideoList.create({authorizedConnection: connection});
  },
  afterModel: function(model, transition){
    var appModel = this.modelFor('application');
    if (appModel.get('needsAuthCode')) {
      this.transitionTo('authorize');
    }
  }
});


App.AuthorizeRoute = Ember.Route.extend({
  afterModel: function(model, transition){
    var appModel = this.modelFor('application');
    if(appModel.get('fullyAuthorized')){
      this.transitionTo('videos');
    } else if (appModel.get('needsAuthCode')) {
      this.transitionTo('authorize');
    }
  },
  actions: {
    openAuthWindow: function() {
      window.open("https://accounts.google.com/o/oauth2/auth?"+
                    "client_id="+window.clientId+
                    "&redirect_uri="+window.redirectUri+
                    "&scope=https://www.googleapis.com/auth/youtube&response_type=code", "Google", "height=600,width=400");
    },

    authorize: function(authToken){
      var _this = this;
      this.modelFor('application').authorize(authToken).then(
        function(){
          _this.transitionTo('videos');
        },
        function(error) {
          console.log(error)
        });
    }
  }
});

//
// ====== Models ========= //
App.AuthorizationState = Ember.Object.extend({

  authCode: null,
  expirationDate: null,
  state: "needsAuthCode",

  init: function(){
    this._readFromLocalStorage();
    this._determineState();
    if(!this.get('authorizationGateway')){
      this.set('authorizationGateway', App.AuthorizationGateway.create());
    };
  },

  deauthorize: function(){
    this.setProperties({
      accessToken: null,
      refreshToken: null,
      expirationDate: null
    });
  },

  authorize: function(authToken){
    var _this = this;
    return this.get('authorizationGateway').
      authorize(authToken).
      then(function(payload){
        _this.setProperties({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          expiresIn: payload.expires_in
        });
      });
  },

  needsAuthCode: function(){
    return this.get('state') === 'needsAuthCode';
  }.property('state'),

  fullyAuthorized: function(){
    return this.get('state') === 'fullyAuthorized';
  }.property('state'),

  _localStorageObserver: function(object,changed){
    var key = "authorizationState."+changed;
    var value = object.get(changed);
    if(value){
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _determineState: function(){
    var newState = "needsAuthCode";
    if(this.get('accessToken') && this.get('refreshToken')){
      newState = 'fullyAuthorized';
    } else {
      newState = 'needsAuthCode';
    }
    this.set('state', newState);
  }.observes('accessToken', 'refreshToken', 'expirationDate'),

  _readFromLocalStorage: function(){
    this.set('accessToken', localStorage["authorizationState.accessToken"]);
    this.set('refreshToken', localStorage["authorizationState.refreshToken"]);
    var expirationDate = localStorage["authorizationState.expirationDate"]
    if(expirationDate){
      this.set('expirationDate', expirationDate);
    }
  },

  _updateExpirationDate: function() {
    var expiresIn = this.get('expiresIn');
    if(expiresIn){
      expiresIn = parseInt(expiresIn, 10);
      var expirationDate = new Date();
      expirationDate.setTime(expirationDate.getTime() + 1000 * expiresIn)
      this.set('expirationDate',expirationDate);
      this.set('expiresIn',null); //expiresIn served its purpose
    }
  }.observes('expiresIn'),
});

App.AuthorizedConnection = Ember.Object.extend({
  getRequest: function(url){
    var accessToken = this.get('authorizationState').get('accessToken');
    url = url + "&access_token="+accessToken;
    return $.ajax(url)
  }
});


App.AuthorizationGateway = Ember.Object.extend({
  authorize: function(authToken){
    var _data = {
      code: authToken,
      client_id: window.clientId,
      client_secret: window.clientSecret,
      redirect_uri: window.redirectUri,
      grant_type: "authorization_code"
    };
    return new Ember.RSVP.Promise(function(resolve, reject) {
      if(!!authToken){
        resolve(authToken);
      } else {
        reject("authToken was " + String(authToken));
      }
    }).then(function(authToken){
      return $.ajax({
        type: "POST",
        url: "https://accounts.google.com/o/oauth2/token",
        data: _data,
        dataType: "text"
      })
    }).then(function(payload){
      return JSON.parse(payload);
    });
  }
});

App.Video = Ember.Object.extend({
  isSelected: false,
  playbackStatus: "UNSTARTED",
  isPlaying: function(){
    return this.get('playbackStatus') === "PLAYING";
  }.property("playbackStatus"),
  isBuffering: function(){
    return this.get('playbackStatus') === "BUFFERING";
  }.property("playbackStatus"),
  playedPercentage: function(currentTime,duration){
    var currentTime = this.get('currentTime');
    var duration    = this.get('duration');
    if(currentTime && duration) {
      return Math.round(currentTime/duration*100);
    } else {
      return 0;
    }
  }.property('currentTime','duration')
});
App.Video.reopenClass({
  createFromRawVideo: function(rawVideo){
    return App.Video.create({
      id: rawVideo.id,
      thumbnailUrl: rawVideo.snippet.thumbnails.default.url,
      title: rawVideo.snippet.title,
      videoId: rawVideo.snippet.resourceId.videoId
    });
  }
});

App.VideoList = Ember.Object.extend({
  watchLaterId: null,
  numberOfVideos: 0,
  rawVideos: [],

  init: function(){
    var api = App.YouTubeApi.create({connection: this.get("authorizedConnection")});
    this.set('youTubeApi', api)
    this.getVideos();
  },

  videos: function(){
    var videos = this.get('rawVideos').map(function(rawVideo) {
      return App.Video.createFromRawVideo(rawVideo);
    });
    return videos.reverse();
  }.property('rawVideos'),

  getVideos: function(){
    var storedVideos = localStorage.getItem('rawVideos');
    if(storedVideos){
      this.set('rawVideos', JSON.parse(storedVideos));
    } else {
      var _this = this;
      this.get('youTubeApi').getVideos().then(function(videos){
        _this.set('rawVideos', videos);
        localStorage.setItem('rawVideos', JSON.stringify(videos));
      });
    }
  },

  _selectVideo: function(){
    this.get('videos').forEach(function(video){
      video.set('isSelected', false);
    });
    this.set('selectedVideo.isSelected', true);
  }.observes('selectedVideo')
});

App.YouTubeApi = Ember.Object.extend({

  getVideos: function(){
    var _this = this;
    return new Ember.RSVP.Promise(function(resolve,reject){
      _this._getWatchLaterId().then(function(watchLaterId){
        _this._getAllPlayListItems(watchLaterId).then(function(videos){
          resolve(videos);
        });
      });
    })
  },

  _getWatchLaterId: function(){
    return this.get('connection').
      getRequest("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true").
      then(function(payload){
        return payload.items[0].contentDetails.relatedPlaylists.watchLater;
      });
  },

  _getAllPlayListItems: function(watchLaterId){
    //Recursivly goes through and gets all items depending on whether the
    //current data page points to a next page or not
    //If it points to a next page, then it will create a new Promise that
    //needs to be resolved first
    var _this = this;
    var recurse = function(watchLaterId,nextPageToken,items){
      items = items || [];
      return new Promise(function(resolve,reject){
        _this._getPlayListItems(watchLaterId,nextPageToken).then(function(data){
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
  },

  _getPlayListItems: function(watchLaterId,pageToken,maxResults){
    maxResults = maxResults || 50;
    var url = "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet"
    url += "&playlistId="+watchLaterId;
    url += "&maxResults="+maxResults;
    if(pageToken && pageToken !== "firstPage"){
      url += "&pageToken="+pageToken;
    }
    return this.get('connection').getRequest(url);
  }

});

App.VideosRoute = Ember.Route.extend({
  model: function(){
    console.log("VideoSRoute");
    return this.modelFor('app');
  },
  setupController: function (controller, model) {
    this._super(controller,model);
    Ember.Instrumentation.subscribe("globalKeys.keyPressed", {
      before: function(name, timestamp, keyChar) {
        controller.send('keyPressed', keyChar);
      },
      after: function() {}
    });
  }
});

function Key(keyChar){
  this.is_a = function(character){
    return (keyChar == character.charCodeAt(0));
  }
}

App.VideosController = Ember.ObjectController.extend({
  actions: {
    keyPressed: function(keyChar){
      var key = new Key(keyChar);
      if(key.is_a('j')){
        console.log("select next");
      } else if(key.is_a('k')) {
        console.log("select previous");
      }
    }
  }
});

App.VideoRoute = Ember.Route.extend({
  model: function(params){
    console.log("VideoRoute");
    return this.modelFor('app').get('videos').findBy('id', params["video_id"])
  }
});

App.VideoController = Ember.ObjectController.extend({
  needs: 'videos',
  _observeSelectedVideo: function(){
    this.get('controllers.videos').model.set('selectedVideo', this.get('content'));
  }.observes('content'),
});

App.VideoView = Ember.View.extend({
  videoHeight: 500,
  videoWidth: 500,
  didInsertElement: function(){
    this.set('videoHeight', $(window).height() - $('header').outerHeight());
    this.set('videoWidth', $(window).width()/3*2 - 15);
  }
});

// ====== Components ========= //
App.VideosListEntryComponent = Ember.Component.extend({
    isSelectedCss: function(){
      return this.get("video.isSelected") ?  "selected" : "not-selected"
    }.property("video.isSelected"),
    isSelectedAndIsPlaying: function(){
      if(this.get('video.isSelected')){
        if (this.get('video.isPlaying') || this.get('video.isBuffering')){
          return "||" ;
        } else {
          return ">";
        }
      } else {
        return "";
      }
    }.property('video.isSelected', 'video.isPlaying'),
    playedPercentage: function(){
      if(this.get('video.isSelected')){
        return this.get('video.playedPercentage') + "%";
      } else {
        return "";
      }
    }.property('video.isSelected', 'video.playedPercentage'),
});

App.VideoPlayerComponent = Ember.Component.extend({
  didInsertElement: function() {

    var _this = this;
    var initializePlayer = function(){
      _this._workaround();

      var player = new window.YT.Player('youtube-player', {
        events: {
          'onReady': function(event){
            player.playVideo();
            if(window.developer_wants_to_keep_his_sanity)
              player.mute();
          },
          'onStateChange': function(event){
            _this.set('playbackStatus', player.getPlayerState());
          },
        }
      });

      setInterval(function(){
        _this.set('video.duration',player.getDuration());
        _this.set('video.currentTime',player.getCurrentTime());
      }, 500);

      player.setSize(_this.get('width'),_this.get('height'));

      _this.set('player', player);
    };

    if(window.YT.Player){
      initializePlayer()
    } else {
      window.onYouTubePlayerAPIReady = initializePlayer;
    }
  },

  _setPlaybackStatus: function(){
    var newState = null;
    switch(this.get('playbackStatus')){
      case YT.PlayerState.UNSTARTED:
        newState = "UNSTARTED";
        break;
      case YT.PlayerState.ENDED:
        newState = "ENDED";
        break;
      case YT.PlayerState.PLAYING:
        newState = "PLAYING";
        break;
      case YT.PlayerState.PAUSED:
        newState = "PAUSED";
        break;
      case YT.PlayerState.BUFFERING:
        newState = "BUFFERING";
        break;
      case YT.PlayerState.CUED:
        newState = "CUED";
        break;
      default:
        newState = null;
    }
    if(newState) {
      this.set('video.playbackStatus', newState);
    }
  }.observes('playbackStatus'),

  _setVideo: function(){
    var player = this.get('player');
    if(player){
      player.loadVideoById(this.get('video.videoId'));
      if(window.developer_wants_to_keep_his_sanity)
        player.mute();
    };
  }.observes('video.videoId'),

  _markAsSelected: function(){
    this.set('video.isSelected', true);
  }.observes('video.videoId'),

  _workaround: function(){
    // Workaround: http://stackoverflow.com/questions/21758040/youtube-iframe-api-onready-not-firing-for-chrome-extension
    new window.YT.Player('dummyTarget');
    var isHttps = $('#dummyTarget').attr('src').indexOf('https') !== -1;
    $('#dummyTarget').remove();

    var url = isHttps ? 'https' : 'http';
    url += '://www.youtube.com/embed/'+this.get('video.videoId')+'?enablejsapi=1&origin=chrome-extension:\\\\hmomohnlpaeihbomcdahmmdkopnhfbga';
    $('#youtube-player').attr('src', url);
  },
});


})();
