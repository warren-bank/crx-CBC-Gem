### [CBC Gem](https://github.com/warren-bank/crx-CBC-Gem/tree/webmonkey-userscript/es5)

[Userscript](https://github.com/warren-bank/crx-CBC-Gem/raw/webmonkey-userscript/es5/webmonkey-userscript/CBC-Gem.user.js) to run in both:
* the [WebMonkey](https://github.com/warren-bank/Android-WebMonkey) application for Android
* the [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) web browser extension for Chrome/Chromium

Its purpose is to:
* redirect embedded videos from [gem.cbc.ca](https://gem.cbc.ca/) to an external player

#### Notes:

* access restrictions:
  - a geo-fence requires that requests originate from an IP within Canada
  - login is required by most videos on the site
  - _Referer_ request header is _not_ required by the video stream host

#### Legal:

* copyright: [Warren Bank](https://github.com/warren-bank)
* license: [GPL-2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt)
