# Watch-later

This README outlines the details of collaborating on this Ember application.

A short introduction of this app could easily go here.

## Prerequisites

You will need the following things properly installed on your computer.

* [Git](http://git-scm.com/)
* [Node.js](http://nodejs.org/) (with NPM) and [Bower](http://bower.io/)

## Installation

* `git clone <repository-url>` this repository
* change into the new directory
* `npm install`
* `bower install`

## Running / Development

* `ember server`
* Visit your app at http://localhost:4200.

### Code Generators

Make use of the many generators for code, try `ember help generate` for more details

### Running Tests

* `ember test`
* `ember test --server`

### Building

* `ember build` (development)
* `ember build --environment production` (production)

### Deploying

Specify what it takes to deploy your app.

## Further Reading / Useful Links

* ember: http://emberjs.com/
* ember-cli: http://www.ember-cli.com/
* Development Browser Extensions
  * [ember inspector for chrome](https://chrome.google.com/webstore/detail/ember-inspector/bmdblncegkenkacieihfhpjfppoconhi)
  * [ember inspector for firefox](https://addons.mozilla.org/en-US/firefox/addon/ember-inspector/)

# TODOs
  * [ ] Better authorization with https://developer.chrome.com/extensions/tut_oauth
  * [ ] Encapsulate retrival logic (e.g. store object?)
  * [ ] Navigating back from video/someid leaves the someid video selected
  * [ ] Save data to chrome.storage.sync instead of loacalStorage
  * [ ] When a video is displayed and nothing is selected then the selection should start at the displayed video
  * [ ] If a video is playing then hide the header and the video list after 5 seconds of inactivity
  * [ ] Store the playback position in the video model (and chrome.storage.sync)
  * [ ] The size of the video is not set properly when coming from /videos
  * [ ] Start playing the last watched video when opening the app (5 second countdown)
  * [ ] Mark videos as watched and ask to remove from playlist if either video ended or I am skipping with only 5% remaining
  * [x] Video list should scroll in place (even when using keyboard)
  * [ ] Skip in video by 10s
  * [ ] Have an event history, let user undo actions (e.g. "played 'video#1' from 13:00 to 17:30", "marked 'video#2' as played")
  * [ ] Fullscreen mode
  * [ ] Submit to Chrome store
  * [ ] Break up application.js (maybe drop ember-cli in)
