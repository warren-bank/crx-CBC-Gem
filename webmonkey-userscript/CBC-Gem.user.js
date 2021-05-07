// ==UserScript==
// @name         CBC Gem
// @description  Watch videos in external player.
// @version      1.0.0
// @match        *://gem.cbc.ca/*
// @match        *://*.gem.cbc.ca/*
// @icon         https://gem.cbc.ca/favicon.png
// @run-at       document-end
// @homepage     https://github.com/warren-bank/crx-CBC-Gem/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-CBC-Gem/issues
// @downloadURL  https://github.com/warren-bank/crx-CBC-Gem/raw/webmonkey-userscript/es5/webmonkey-userscript/CBC-Gem.user.js
// @updateURL    https://github.com/warren-bank/crx-CBC-Gem/raw/webmonkey-userscript/es5/webmonkey-userscript/CBC-Gem.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "poll_window_interval_ms":        500,
  "poll_window_timeout_ms":       30000,

  "redirect_to_webcast_reloaded": true,
  "force_http":                   true,
  "force_https":                  false
}

// ----------------------------------------------------------------------------- state

var state = {
  "poll_window_timer":            0
}

// ----------------------------------------------------------------------------- retry until success or timeout occurs

var max_poll_window_attempts = Math.ceil(user_options.poll_window_timeout_ms / user_options.poll_window_interval_ms)

var clear_poll_window_timer = function() {
  if (!state.poll_window_timer) return

  unsafeWindow.clearTimeout(state.poll_window_timer)
  state.poll_window_timer = 0
}

var poll_window = function(process_window, count_poll_window_attempts) {
  if (!count_poll_window_attempts)
    count_poll_window_attempts = 0

  count_poll_window_attempts++

  if (count_poll_window_attempts <= max_poll_window_attempts) {
    if (!process_window()) {
      state.poll_window_timer = unsafeWindow.setTimeout(
        function() {
          clear_poll_window_timer()

          poll_window(process_window, count_poll_window_attempts)
        },
        user_options.poll_window_interval_ms
      )
    }
  }
}

var delay_poll_window = function(process_window, delay_ms) {
  clear_poll_window_timer()

  if (!delay_ms)
    delay_ms = 0

  state.poll_window_timer = unsafeWindow.setTimeout(
    function() {
      clear_poll_window_timer()

      poll_window(process_window)
    },
    delay_ms
  )
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.force_https

  var encoded_video_url, encoded_vtt_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_vtt_url       = vtt_url ? encodeURIComponent(encodeURIComponent(btoa(vtt_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_vtt_url ? ('/subtitle/' + encoded_vtt_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  clear_poll_window_timer()

  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href)

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
  clear_poll_window_timer()

  if (!referer_url)
    referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ video_url,
      /* type   = */ video_type
    ]

    // extras:
    if (vtt_url) {
      args.push('textUrl')
      args.push(vtt_url)
    }
    if (referer_url) {
      args.push('referUrl')
      args.push(referer_url)
    }

    GM_startIntent.apply(this, args)
    return true
  }
  else if (user_options.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(video_url, vtt_url, referer_url))
    return true
  }
  else {
    return false
  }
}

var process_hls_url = function(hls_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ hls_url, /* video_type= */ 'application/x-mpegurl', vtt_url, referer_url)
}

var process_dash_url = function(dash_url, vtt_url, referer_url) {
  process_video_url(/* video_url= */ dash_url, /* video_type= */ 'application/dash+xml', vtt_url, referer_url)
}

// ----------------------------------------------------------------------------- process page

var process_page = function() {
  var the_player, playlist, playlist_item, source, video_url, video_type, track, vtt_url, referer_url

  if (
       unsafeWindow.jwplayer
    && ('function' === (typeof unsafeWindow.jwplayer))
  ) {
    // process jwplayer playlist sources

    the_player = unsafeWindow.jwplayer()

    if (
         the_player
      && ('object'   === (typeof the_player))
      && ('function' === (typeof the_player.getPlaylist))
    ) {
      playlist = the_player.getPlaylist()

      if (playlist && Array.isArray(playlist) && playlist.length) {
        for (var i=0; !video_url && (i < playlist.length); i++) {
          playlist_item = playlist[i]

          if (playlist_item && ('object' === (typeof playlist_item)) && playlist_item.sources && Array.isArray(playlist_item.sources) && playlist_item.sources.length) {
            for (var i2=0; !video_url && (i2 < playlist_item.sources.length); i2++) {
              source = playlist_item.sources[i2]

              if (!source.file) continue

              switch(source.type) {
                case "hls":
                  video_url  = source.file + '#video.m3u8'
                  video_type = 'application/x-mpegurl'
                  break
                case "dash":
                  video_url  = source.file + '#video.ism'
                  video_type = 'application/dash+xml'
                  break
                default:
                  video_url  = source.file + ((source.type) ? ('#video.' + source.type) : '')
                  video_type = (source.type) ? ('video/' + source.type) : null
                  break
              }

              if (source.tracks && Array.isArray(source.tracks) && source.tracks.length) {
                for (var i3=0; i3 < source.tracks.length; i3++) {
                  track = source.tracks[i3]

                  if (track && ('object' === (typeof track)) && track.file) {
                    vtt_url = track.file
                    break
                  }
                }
              }
            }
          }
        }
      }

      if (video_url) {
        referer_url = unsafeWindow.location.href
        process_video_url(video_url, video_type, vtt_url, referer_url)
        return true
      }
    }
  }

  // retry after delay
  return false
}

// ----------------------------------------------------------------------------- bootstrap

var init = function() {
  unsafeWindow.window.onbeforeunload = clear_poll_window_timer

  delay_poll_window(process_page, 0)
}

init()

// -----------------------------------------------------------------------------
