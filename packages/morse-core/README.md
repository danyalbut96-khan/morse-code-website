# @morse-signal-studio/core

Dependency-free International Morse encoder/decoder.

```js
const { encode, decode } = require('@morse-signal-studio/core');
encode('SOS 123');
decode('... --- ... / .---- ..--- ...--');
```

ESM and CommonJS entry points are included. Run `npm test` in this directory. The package is prepared for publication but has not been published to npm yet. Arabic/Urdu extension mappings are maintained in the main app and are not part of this minimal International Morse package.
