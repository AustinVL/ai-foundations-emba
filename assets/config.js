/* The one place the Relay app address lives.
   publish_site.py reads the value on the last line and writes it into
   relay/index.html as a plain link, so the button also works with JavaScript off.
   Leave the quotes empty until the app is deployed. Set it with:
     python publish_site.py --relay-url https://the-app-address/               */
window.EMBA = { relayUrl: "" };
