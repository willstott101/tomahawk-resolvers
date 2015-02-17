/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

var WimpResolver = Tomahawk.extend(TomahawkResolver, {
    //clientId: "TiNg2DRYhBnp01DA3zNag",
    api: {
        url: "https://listen.tidalhifi.com/v1/",

        // Sent for login
        token: "P5Xbeo5LFvESeDy6",
        username: "",
        password: "",

        // Sent for api requests
        userId: "",
        countryCode: "",
        sessionId: "",

        // State information
        // TODO: Garbage collection
        chunks: {},

        // Useful information
        authenticated: 0,
        highestSoundQuality: "LOSSLESS" // Just try for lossless by default
    },

    settings: {
        name: 'TidalHiFi',
        icon: 'soundcloud-icon.png',
        weight: 85,
        timeout: 15
    },

    resolveQueue: {},

    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {
            "widget": uiData,
            fields: [{
                name: "user",
                widget: "user_edit",
                property: "text"
            }, {
                name: "password",
                widget: "password_edit",
                property: "text"
            }],
            images: [{
                "soundcloud.png" : Tomahawk.readBase64("soundcloud.png")
            }]
        };
    },

    newConfigSaved: function () {
        var userConfig = this.getUserConfig();

        if (this.api.username !== userConfig.user || this.api.password !== userConfig.password) {
            this.init();
        }
    },

    encodeData: function (data) {
        return Object.keys(data).map(function (key) {
            return [key, data[key]].map(encodeURIComponent).join("=");
        }).join("&");
    },

    encodeQuery: function (data) {
        return Object.keys(data).map(function (key) {
            return [key, data[key]].map(escape).join("=");
        }).join("&");
    },

    buildUrl: function (service, action, params, rawparams) {
        if (params) {
            params = this.encodeData(params);
        } else { params = "" }
        if (rawparams) {
            rawparams = this.encodeQuery(rawparams);
        } else { rawparams = "" }
        params += rawparams.length > 0 ? "&" : ""
        return service.url + action + "?" + params + rawparams;
    },

    login: function (callback) {
        var that = this;
        // Build login url
        var url = this.buildUrl(this.api, 'login/username', {'token':this.api.token});
        // Format request
        var formData = {
            "username": this.api.username,
            "password": this.api.password
        };
        var options = {
            "method": "POST",
            "data": this.encodeData(formData),
            "errorHandler": function () {
                Tomahawk.log("TidalHiFi authentication failed.");
                that.api.authenticated = -1;
            }
        };
        var headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": options.data.length
        };
        // Perform request
        Tomahawk.asyncRequest(url, function (xhr) {
            // Format response
            var res = JSON.parse(xhr.responseText);
            for (key in res) {
                Tomahawk.log("LOGIN RESPONSE: " + key + ": " + res[key]);
            }
            that.api.userId = res.userId;
            that.api.countryCode = res.countryCode;
            that.api.sessionId = res.sessionId;
            // We are logged in. Just need some more information.
            that.api.authenticated = 1;
            that.afterLogin(callback);
        }, headers, options);

        if (callback) {
            callback(null);
        }
    },

    afterLogin: function(callback) {
        var that = this;
        // Build login url
        var url = this.buildUrl(
            this.api,
            'users/' + this.api.userId + '/subscription',
            {
                'sessionId': this.api.sessionId,
                'countryCode': this.api.countryCode
        });
        var options = {
            "method": "GET"
        };
        var headers = {
        };
        // Perform request
        Tomahawk.asyncRequest(url, function (xhr) {
            // Typical response:
                // {"validUntil":"2015-01-03T18:42:42.234+0000","status":"ACTIVE","subscription":{"type":"HIFI"},"highestSoundQuality":"LOSSLESS"}
            var res = JSON.parse(xhr.responseText);
            for (key in res) {
                Tomahawk.log("USER SUB RESPONSE: " + key + ": " + res[key]);
            }
            // Currently only interested in max sound quality.
            that.api.highestSoundQuality = res.highestSoundQuality;
            // We are now prepared to do sound file requests.
            that.api.authenticated = 2;

        }, headers, options);

        // Resolve any songs which Tomahawk tried to resolve whilst we were unauthenticated.
        for (qid in this.resolveQueue) {
            var q  = this.resolveQueue[qid];
            this.resolve(qid, q.artist, q.album, q.title);
        }
    },

    /**
     * Initialise the resolver.
     *
     * @param callback function(err) Callback that notifies when the resolver was initialised.
     */
    init: function (callback) {
        var that = this;
        this.api.authenticated = 0;
        this.resolveQueue = {};
        // Set userConfig here
        var userConfig = this.getUserConfig();
        if ( userConfig !== undefined ) {
            // this.preferredQuality = userConfig.quality;
            this.api.username = userConfig.user;
            this.api.password = userConfig.password;
            
            // Login to the wimp api
            this.login(callback);
        }


        String.prototype.capitalize = function(){
            return this.replace( /(^|\s)([a-z])/g , function(m,p1,p2){ return p1+p2.toUpperCase(); } );
        };
        
        Tomahawk.reportCapabilities(TomahawkResolverCapability.UrlLookup);
    },

    resolve: function (qid, artist, album, title)
    {
        var that = this;

        // If we are not yet authenticated, add the request to the queue.
        if (this.api.authenticated === 0) {
            if  (!this.resolveQueue.hasOwnProperty(qid)) {
                this.resolveQueue[qid] = {
                    'artist': artist, 
                    'album': album, 
                    'title': title
                };
            }
            return;
        }

        var query = title + " " + artist;
        query += album ? " " + album : "";
        // Format for the url
        query = query.split("+").join("");
        query = query.split(" ").join("+");

        var url = this.buildUrl(
            this.api,
            'search/tracks',
            {
                'sessionId': this.api.sessionId,
                'countryCode': this.api.countryCode,
                'limit': 25
            },
            { 'query': query }
        );
        var empty = {
            results: [],
            qid: qid
        };
        Tomahawk.log("About to try and resolve: " + url);
        Tomahawk.asyncRequest(url, function (xhr) {
            var response = JSON.parse(xhr.responseText).items;
            Tomahawk.log("Got " + response.length + " responses.");
            if (response.length > 0)
            {
                var results = [];
                for (i = 0; i < response.length; i++) {
                    var track = response[i];
                    // {
                    // album: {id: 15528913, title: "The Best of Both Worlds", cover: "8c495ce5-200f-407b-a44e-770aa8e9af00"},
                    // cover: "8c495ce5-200f-407b-a44e-770aa8e9af00",
                    // id: 15528913,
                    // title: "The Best of Both Worlds",
                    // allowStreaming: true,
                    // artist: {id: 4878559, name: "Charles Jenkins & Fellowship Chicago"},
                    // id: 4878559,
                    // name: "Charles Jenkins & Fellowship Chicago",
                    // copyright: "(P) 2012 Inspired People Music. All rights reserved. / Inspired People Music",
                    // duration: 349,
                    // id: 15528917,
                    // popularity: 14,
                    // premiumStreamingOnly: false,
                    // streamReady: true,
                    // streamStartDate: "2013-03-24T23:00:00.000+0000",
                    // title: "Awesome",
                    // trackNumber: 4,
                    // url: "http://www.wimpmusic.com/track/15528917",
                    // version: null,
                    // volumeNumber: 1 }

                    // Check for streamable tracks only
                    if (!track.allowStreaming || !track.streamReady) {
                        // I have no real idea what streamReady means.
                        continue;
                    }
                    Tomahawk.log("At least one of which was streamable.");
                    var result = {
                        source: that.settings.name,
                        // Might be better not to assume these exist.
                        artist: track.artist.name,
                        track: track.title,
                        linkurl: track.url,
                    };
                    if (track.duration) result.duration = track.duration;
                    if (track.album) {
                        if (track.album.trackNumber) result.albumpos = track.album.trackNumber;
                        if (track.album.title) result.album = track.album.title;
                    }

                    var url = that.buildUrl(
                        that.api,
                        'tracks/' + track.id + '/streamUrl',
                        {
                            'sessionId': that.api.sessionId,
                            'countryCode': that.api.countryCode,
                            'soundQuality': that.api.highestSoundQuality
                    });
                    Tomahawk.asyncRequest(url, function (xhr) {
                        var response = JSON.parse(xhr.responseText);
                        // {
                        // playTimeLeftInMinutes: -1 // Seems useless
                        // soundQuality: "HIGH" // or "LOSSLESS"
                        // trackId: 14686194
                        // url: "???..." } // Can be mp4 or flac
                        for (key in response) {
                            Tomahawk.log("Stream response: " + key + ": " + response[key]);
                        }
                        if (response.soundQuality == "LOSSLESS") {
                            result.score = 0.9;
                            result.mimetype = "audio/flac";
                        } else if (response.soundQuality == "HIGH") {
                            result.mimetype = "audio/mp4";
                            result.score = 0.85;
                        }
                         else if (response.soundQuality == "LOW") {
                            result.mimetype = "audio/mp4";
                            result.score = 0.7;
                        }
                        result.checked = true;
                        result.url = response.url;

                        Tomahawk.log("Adding result from TidalHiFi: " + qid);
                        for (key in result) {
                            Tomahawk.log("result." + key + " = " + result[key]);
                        }

                        results.push(result);
                        Tomahawk.addTrackResults({qid:qid, results:results});
                    });
                    // Todo: By using a valid score, return them all.
                    break;
                }
            } else {
                Tomahawk.addTrackResults(empty);
            }
        });
    },

    getStreamUrl: function (qid, urn) {
        var that = this;
        // We need vlc to use this header.
        // Range: bytes=12582912-17825791
        var lastByte = that.api.chunks[urn];
        that.api.chunks[urn] += that.api.chunkSize;
        Tomahawk.reportStreamUrl(qid, urn, {
            'Range': 'bytes=' + lastByte + '-' + that.api.chunks[urn],
            //'Authorization': 'GoogleLogin auth=' + this._token,
            //'X-Device-ID'  : this._deviceId
        });
        Tomahawk.log("getStreamUrl(" + qid + ", " + urn);
    }

    // search: function (qid, searchString)
    // {
    //     var apiQuery = "https://api.soundcloud.com/tracks.json?consumer_key=TiNg2DRYhBnp01DA3zNag&filter=streamable&q=" + encodeURIComponent(searchString.replace('"', '').replace("'", ""));
    //     var that = this;
    //     var empty = {
    //         results: [],
    //         qid: qid
    //     };
    //     Tomahawk.asyncRequest(apiQuery, function (xhr) {
    //         var resp = JSON.parse(xhr.responseText);
    //         if (resp.length !== 0){
    //             var results = [];
    //             var stop = resp.length;
    //             for (i = 0; i < resp.length; i++) {
    //                 if(resp[i] === undefined){
    //                     stop = stop - 1;
    //                     continue;
    //                 }
    //                 var result = {};

    //                 if (that.getTrack(resp[i].title, "")){
    //                     var track = resp[i].title;
    //                     if (track.indexOf(" - ") !== -1 && track.slice(track.indexOf(" - ") + 3).trim() !== ""){
    //                         result.track = track.slice(track.indexOf(" - ") + 3).trim();
    //                         result.artist = track.slice(0, track.indexOf(" - ")).trim();
    //                     } else if (track.indexOf(" -") !== -1 && track.slice(track.indexOf(" -") + 2).trim() !== ""){
    //                         result.track = track.slice(track.indexOf(" -") + 2).trim();
    //                         result.artist = track.slice(0, track.indexOf(" -")).trim();
    //                     } else if (track.indexOf(": ") !== -1 && track.slice(track.indexOf(": ") + 2).trim() !== ""){
    //                         result.track = track.slice(track.indexOf(": ") + 2).trim();
    //                         result.artist = track.slice(0, track.indexOf(": ")).trim();
    //                     } else if (track.indexOf("-") !== -1 && track.slice(track.indexOf("-") + 1).trim() !== ""){
    //                         result.track = track.slice(track.indexOf("-") + 1).trim();
    //                         result.artist = track.slice(0, track.indexOf("-")).trim();
    //                     } else if (track.indexOf(":") !== -1 && track.slice(track.indexOf(":") + 1).trim() !== ""){
    //                         result.track = track.slice(track.indexOf(":") + 1).trim();
    //                         result.artist = track.slice(0, track.indexOf(":")).trim();
    //                     } else if (track.indexOf("\u2014") !== -1 && track.slice(track.indexOf("\u2014") + 2).trim() !== ""){
    //                         result.track = track.slice(track.indexOf("\u2014") + 2).trim();
    //                         result.artist = track.slice(0, track.indexOf("\u2014")).trim();
    //                     } else if (resp[i].title !== "" && resp[i].user.username !== ""){
    //                         // Last resort, the artist is the username
    //                         result.track = resp[i].title;
    //                         result.artist = resp[i].user.username;
    //                     } else {
    //                         stop = stop - 1;
    //                         continue;
    //                     }
    //                 } else {
    //                     stop = stop - 1;
    //                     continue;
    //                 }

    //                 result.source = that.settings.name;
    //                 result.mimetype = "audio/mpeg";
    //                 result.bitrate = 128;
    //                 result.duration = resp[i].duration / 1000;
    //                 result.score = 0.85;
    //                 result.year = resp[i].release_year;
    //                 result.url = resp[i].stream_url + ".json?client_id=TiNg2DRYhBnp01DA3zNag";
    //                 if (resp[i].permalink_url !== undefined){
    //                     result.linkUrl = resp[i].permalink_url;
    //                 }

    //                 (function (i, result) {
    //                     var artist = encodeURIComponent(result.artist.capitalize());
    //                     var url = "https://developer.echonest.com/api/v4/artist/extract?api_key=JRIHWEP6GPOER2QQ6&format=json&results=1&sort=hotttnesss-desc&text=" + artist;
    //                     Tomahawk.asyncRequest(url, function (xhr) {
    //                         var response = JSON.parse(xhr.responseText).response;
    //                         if (response && response.artists && response.artists.length > 0) {
    //                             artist = response.artists[0].name;
    //                             result.artist = artist;
    //                             result.id = i;
    //                             results.push(result);
    //                             stop = stop - 1;
    //                         } else {
    //                             stop = stop - 1;
    //                         }
    //                         if (stop === 0) {
    //                             function sortResults(a, b){
    //                                 return a.id - b.id;
    //                             }
    //                             results = results.sort(sortResults);
    //                             for (var j = 0; j < results.length; j++){
    //                                 delete results[j].id;
    //                             }
    //                             var toReturn = {
    //                                 results: results,
    //                                 qid: qid
    //                             };
    //                             Tomahawk.addTrackResults(toReturn);
    //                         }
    //                     });
    //                 })(i, result);
    //             }
    //             if (stop === 0) {
    //                 Tomahawk.addTrackResults(empty);
    //             }
    //         }
    //         else {
    //             Tomahawk.addTrackResults(empty);
    //         }
    //     });
    // },

    // canParseUrl: function (url, type) {
    //     // Soundcloud only returns tracks and playlists
    //     switch (type) {
    //         case TomahawkUrlType.Album:
    //             return false;
    //         case TomahawkUrlType.Artist:
    //             return false;
    //         // case TomahawkUrlType.Playlist:
    //         // case TomahawkUrlType.Track:
    //         // case TomahawkUrlType.Any:
    //         default:
    //             return (/https?:\/\/(www\.)?soundcloud.com\//).test(url);
    //     }
    // },

    // track2Result: function (track) {
    //     var result = {
    //         type: "track",
    //         title: track.title,
    //         artist: track.user.username
    //     };

    //     if (!(track.stream_url === null || typeof track.stream_url === "undefined")) {
    //         result.hint = track.stream_url + "?client_id=" + this.clientId;
    //     }
    //     return result;
    // },

    // lookupUrl: function (url) {
    //     var query = "https://api.soundcloud.com/resolve.json?client_id=" + this.clientId + "&url=" + encodeURIComponent(url.replace(/\/likes$/, ''));
    //     var that = this;
    //     Tomahawk.asyncRequest(query, function (xhr) {
    //         var res = JSON.parse(xhr.responseText);
    //         if (res.kind == "playlist") {
    //             var result = {
    //                 type: "playlist",
    //                 title: res.title,
    //                 guid: 'soundcloud-playlist-' + res.id.toString(),
    //                 info: res.description,
    //                 creator: res.user.username,
    //                 url: res.permalink_url,
    //                 tracks: []
    //             };
    //             res.tracks.forEach(function (item) {
    //                 result.tracks.push(that.track2Result(item));
    //             });
    //             Tomahawk.addUrlResult(url, result);
    //         } else if (res.kind == "track") {
    //             Tomahawk.addUrlResult(url, that.track2Result(res));
    //         } else if (res.kind == "user") {
    //             var url2 = res.uri;
    //             var prefix = 'soundcloud-';
    //             var title = res.full_name + "'s ";
    //             if (url.indexOf("/likes") === -1) {
    //                 url2 += "/tracks.json?client_id=" + that.clientId;
    //                 prefix += 'user-';
    //                 title += "Tracks";
    //             } else {
    //                 url2 += "/favorites.json?client_id=" + that.clientId;
    //                 prefix += 'favortites-';
    //                 title += "Favorites";
    //             }
    //             Tomahawk.asyncRequest(url2, function (xhr2) {
    //                 var res2 = JSON.parse(xhr2.responseText);
    //                 var result = {
    //                     type: "playlist",
    //                     title: title,
    //                     guid: prefix + res.id.toString(),
    //                     info: title,
    //                     creator: res.username,
    //                     url: res2.permalink_url,
    //                     tracks: []
    //                 };
    //                 res2.forEach(function (item) {
    //                     result.tracks.push(that.track2Result(item));
    //                 });
    //                 Tomahawk.addUrlResult(url, result);
    //             });
    //             return;
    //         } else {
    //             Tomahawk.log("Could not parse SoundCloud URL: " + url);
    //             Tomahawk.addUrlResult(url, {});
    //         }
    //     });
    // }
});

Tomahawk.resolver.instance = WimpResolver;
