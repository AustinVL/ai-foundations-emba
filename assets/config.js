/* The one place the Relay app address lives.
   publish_site.py reads this same value and writes it into relay/index.html
   as a plain link, so the button also works with JavaScript off.
   Leave it empty until the app is deployed:  relayUrl: ""                    */
window.EMBA = { relayUrl: "" };
