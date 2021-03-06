(function() {
$(document).keypress(function(e) {
  var noop = function(){};
  Ember.Instrumentation.instrument("globalKeys.keyPressed", e.which, noop);
  return false;
});

window.App = Ember.Application.create({
  LOG_TRANSITIONS: true,
  LOG_TRANSITIONS_INTERNAL: true,
  LOG_VIEW_LOOKUPS: true
});

window.developer_wants_to_keep_his_sanity = true;

function ScrollPositionStrategy(container, elements, selectedIndex){
  // There are probably easier way of codifying this, but my goal was clarity

  this.calculate = function(){
    var scrollTop = 0;
    if(container && elements && (selectedIndex>=0)){
      scrollTop = this._topOfVisibleArea();
      if(this._selectionProtrudesBottom()){
        scrollTop = this._bottomOfSelected() - container.innerHeight();
      }
      if(this._selectionProtrudesTop()){
        scrollTop = this._topOfSelected();
      }
    }
    return scrollTop;
  };

  this._selectionProtrudesBottom = function(){
    return this._bottomOfSelected() > this._bottomOfVisibleArea();
  };

  this._selectionProtrudesTop = function(){
    return this._topOfSelected() < this._topOfVisibleArea();
  };

  this._topOfSelected = function(){
    return this._upperBorderOf(selectedIndex);
  };

  this._bottomOfSelected = function(){
    return this._upperBorderOf(selectedIndex + 1);
  };

  this._topOfVisibleArea = function(){
    return container.scrollTop()
  };

  this._bottomOfVisibleArea = function(){
    return container.scrollTop() + container.innerHeight();
  };

  this._upperBorderOf = function(i){
    var before = elements.slice(0,i);
    var heights = $.map(before, function(el){
      return $(el).outerHeight();
    });
    return heights.reduce(function(a,b){ return a+b },0);
  };
}

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
  isDisplayed: false,
  playbackStatus: "UNSTARTED",
  desiredPlaybackStatus: "PLAYING",
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
  }.property('currentTime','duration'),
  togglePlayPause: function(){
    if(this.get('isPlaying')){
      this.set('desiredPlaybackStatus', "PAUSED")
    } else {
      this.set('desiredPlaybackStatus', "PLAYING")
    }
  }

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
  //TODO: This sounds less and less like a model and more like a data adapter
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

  actions: {
    changeVideo: function(id){
      this.transitionTo('video', id);
    }
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
  this.is = function(query){
    if(query.length == 1){
      return (keyChar == query.charCodeAt(0));
    } else {
      return (query === 'enter' && keyChar == 13) ||
             (query === 'space' && keyChar == 32);
    }
  }
}

App.VideosController = Ember.ObjectController.extend({

  displayedVideo: null,
  selectedVideo: null,
  selectedVideoIndex: -1,

  actions: {
    keyPressed: function(keyChar){
      var key = new Key(keyChar);
      if(key.is('j')){
        this.selectNext();
      } else if(key.is('k')) {
        this.selectPrevious();
      } else if(key.is('enter')) {
        this.displayVideo();
      } else if(key.is('space')) {
        var displayedVideo = this.get('displayedVideo');
        if(displayedVideo){
          displayedVideo.togglePlayPause();
        }
      }
    }
  },

  selectNext: function(){
    var index = this.get('selectedVideoIndex');
    var newIndex = Math.min(index+1, this.get('videos').length-1);
    this.set('selectedVideoIndex', newIndex);
  },

  selectPrevious: function(){
    var index = this.get('selectedVideoIndex');
    var newIndex = Math.max(index-1, 0);
    this.set('selectedVideoIndex', newIndex);
  },

  displayVideo: function(){
    this.send('changeVideo', this.get('selectedVideo.id'));
  },

  _observeDisplayedVideo: function(){
    this.get('videos').forEach(function(video){
      video.set('isDisplayed', false);
    });
    this.set('displayedVideo.isDisplayed', true);
  }.observes('displayedVideo'),

  _observeSelectedVideo: function(){
    var selectedVideo = this.get('videos')[this.get('selectedVideoIndex')];
    this.set('selectedVideo', selectedVideo);
    this.get('videos').forEach(function(video){
      video.set('isSelected', false);
    });
    this.set('selectedVideo.isSelected', true);
  }.observes('selectedVideoIndex')
});

App.VideoRoute = Ember.Route.extend({
  model: function(params){
    console.log("VideoRoute");
    return this.modelFor('app').get('videos').findBy('id', params["video_id"])
  }
});

App.VideoController = Ember.ObjectController.extend({
  needs: 'videos',
  _observeDisplayedVideo: function(){
    this.get('controllers.videos').set('displayedVideo', this.get('content'));
  }.observes('content'),
});

App.VideosView = Ember.View.extend({
  didInsertElement: function(){
    var newHeight = $(window).height() - $('header').outerHeight();
    this.$('#videos').height(newHeight);
  },
  _selectionObserver: function(){
    var container = this.$("#videos");
    var elements = this.$('#videos li');
    var i = this.get('controller.selectedVideoIndex');
    var scrollPosition = new ScrollPositionStrategy(container,elements,i);
    $(container).scrollTop(scrollPosition.calculate());
  }.observes('controller.selectedVideoIndex')
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
    isDisplayedCss: function(){
      return this.get("video.isDisplayed") ?  "displayed" : "not-displayed"
    }.property("video.isDisplayed"),
    isSelectedCss: function(){
      return this.get("video.isSelected") ?  "selected" : "not-selected"
    }.property("video.isSelected"),
    computedCss: function(){
      return this.get("isSelectedCss") + " " + this.get("isDisplayedCss");
    }.property("isSelectedCss","isDisplayedCss"),
    isDisplayedAndIsPlaying: function(){
      if(this.get('video.isDisplayed')){
        if (this.get('video.isPlaying') || this.get('video.isBuffering')){
          return "||" ;
        } else {
          return ">";
        }
      } else {
        return "";
      }
    }.property('video.isDisplayed', 'video.isPlaying'),
    playedPercentage: function(){
      if(this.get('video.isDisplayed')){
        return this.get('video.playedPercentage') + "%";
      } else {
        return "";
      }
    }.property('video.isDisplayed', 'video.playedPercentage')
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
        if(player && player.getDuration && player.getCurrentTime){
          _this.set('video.duration',player.getDuration());
          _this.set('video.currentTime',player.getCurrentTime());
        }
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

  _observeDesiredPlaybackStatus: function(){
    var newStatus = this.get('video.desiredPlaybackStatus')
    if(newStatus === "PLAYING" ){
      this.get('player').playVideo();
    } else if(newStatus === "PAUSED" ) {
      this.get('player').pauseVideo();
    }
  }.observes('video.desiredPlaybackStatus'),

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

  _markAsDisplayed: function(){
    this.set('video.isDisplayed', true);
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
