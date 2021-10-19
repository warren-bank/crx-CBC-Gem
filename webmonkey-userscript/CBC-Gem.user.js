// ==UserScript==
// @name         CBC Gem
// @description  Watch videos in external player.
// @version      2.0.4
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
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

var constants = {
  "login": {
    "username": "",
    "password": "",
    "ms_delay": 5000
  }
}

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, vtt_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

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
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

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

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_url = function(video_url, video_type, vtt_url, referer_url) {
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
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
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

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  xhr.send()
}

// ----------------------------------------------------------------------------- process VOD video page

var process_vod_video_page = function(page_id) {
  var url_browse      = 'https://api-cbc.cloud.clearleap.com/cloffice/V4/client/web/browse/' + page_id + '?max=20&offset=0'
  var headers_browse  = null
  var callback_browse = function(xml_browse) {
    if (!xml_browse) return
    xml_browse = xml_browse.replace(/[\t\r\n]+/g, ' ')

    var regex_browse = /^.*?<media:content url=['"]([^'"]+)['"].*$/
    if (!regex_browse.test(xml_browse)) return

    var url_play     = xml_browse.replace(regex_browse, '$1')
    var deviceId     = localStorage.getItem("deviceId")
    var deviceToken  = localStorage.getItem("deviceToken")
    var headers_play = (deviceId && deviceToken)
      ? {
          "Access-Control-Request-Headers": "x-clearleap-deviceid,x-clearleap-devicetoken",
          "X-Clearleap-DeviceId":           deviceId,
          "X-Clearleap-DeviceToken":        deviceToken
        }
      : null

    var callback_play = function(xml_play) {
      if (!xml_play) return
      xml_play = xml_play.replace(/[\t\r\n]+/g, ' ')

      var regex_play = /^.*?<url>(.+?)<\/url>.*$/
      if (!regex_play.test(xml_play)) return

      var hls_url = xml_play.replace(regex_play, '$1')
      process_hls_url(hls_url)
    }

    download_text(url_play, headers_play, callback_play)
  }

  download_text(url_browse, headers_browse, callback_browse)
}

// ----------------------------------------------------------------------------- process live video page

var process_live_video_page = function(page_id) {
  var url_mainjs      = 'https://gem.cbc.ca/public/js/main.js'
  var headers_mainjs  = null
  var callback_mainjs = function(txt_mainjs) {
    if (!txt_mainjs) return
    txt_mainjs = txt_mainjs.replace(/[\t\r\n]+/g, ' ')

    var regex_mainjs = /^.*LLC_URL=[^'"]{0,5}['"]([^'"]+)['"].*$/
    if (!regex_mainjs.test(txt_mainjs)) return

    var url_llc = txt_mainjs.replace(regex_mainjs, '$1')
    if (url_llc.indexOf('//') === 0)
      url_llc = unsafeWindow.location.protocol + url_llc

    var headers_llc  = null
    var callback_llc = function(json_llc) {
      if (!json_llc) return

      try {
        json_llc = JSON.parse(json_llc)
      }
      catch(error) {}

      if (!json_llc || ('object' !== (typeof json_llc)) || !Array.isArray(json_llc.entries) || !json_llc.entries.length) return

      var obj, entry
      for (var i=0; i < json_llc.entries.length; i++) {
        obj = json_llc.entries[i]

        if (obj && ('object' === (typeof obj)) && (obj.guid === page_id) && Array.isArray(obj.content) && obj.content.length) {
          entry = obj
          break
        }
      }
      obj = null
      if (!entry) return

      var url_content
      for (var i=0; i < entry.content.length; i++) {
        obj = entry.content[i]

        if (obj && ('object' === (typeof obj)) && obj.url) {
          url_content = obj.url
          break
        }
      }
      obj = null
      if (!url_content) return

      var headers_content  = null
      var callback_content = function(smil_content) {
        if (!smil_content) return
        smil_content = smil_content.replace(/[\t\r\n]+/g, ' ')

        var regex_content = /^.*?<video [^>]*src=['"]([^'"]+)['"].*$/
        if (!regex_content.test(smil_content)) return

        var hls_url = smil_content.replace(regex_content, '$1')
        process_hls_url(hls_url)
      }

      download_text(url_content, headers_content, callback_content)
    }

    download_text(url_llc, headers_llc, callback_llc)
  }

  download_text(url_mainjs, headers_mainjs, callback_mainjs)
}

// ----------------------------------------------------------------------------- process video page

var process_video_page = function(pathname, page_id) {
  if (pathname.indexOf('/media/') === 0) {
    process_vod_video_page(page_id)
    return true
  }
  if (pathname.indexOf('/live/') === 0) {
    process_live_video_page(page_id)
    return true
  }
  return false
}

// ----------------------------------------------------------------------------- process login page

var process_login_page = function() {
  var count = 0
  var el
  if (constants.login.username) {
    el = unsafeWindow.document.querySelector('form.user-form input#username')
    if (el) {
      el.value = constants.login.username
      el.dispatchEvent(new Event('blur'))
      count++
    }
  }
  if (constants.login.password) {
    el = unsafeWindow.document.querySelector('form.user-form input#password')
    if (el) {
      el.value = constants.login.password
      el.dispatchEvent(new Event('blur'))
      count++
    }
  }
  if (count === 2) {
    el = unsafeWindow.document.querySelector('form.user-form button[type="submit"]')
    if (el && !el.disabled) {
      el.click()
    }
  }
}

// ----------------------------------------------------------------------------- bootstrap

var intercept_history_redirects = function() {
  var interceptor = function(state, title, url) {
    redirect_to_url(url)
  }

  if (unsafeWindow.history) {
    unsafeWindow.history.pushState    = interceptor
    unsafeWindow.history.replaceState = interceptor
  }
}

var init_login_page = function() {
  if ('/login' !== unsafeWindow.location.pathname) return false

  unsafeWindow.setTimeout(process_login_page, constants.login.ms_delay)
  return true
}

var init_video_page = function() {
  var pathname = unsafeWindow.location.pathname
  if (!pathname) return false

  var page_id = pathname.substr(pathname.lastIndexOf('/') + 1)
  if (!page_id) return false

  return process_video_page(pathname, page_id)
}

var init = function() {
  if ((typeof GM_getUrl === 'function') && (GM_getUrl() !== unsafeWindow.location.href)) return

  intercept_history_redirects()

  init_login_page() || init_video_page()
}

init()

// -----------------------------------------------------------------------------
