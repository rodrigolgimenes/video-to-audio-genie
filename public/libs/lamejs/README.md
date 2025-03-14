
# lamejs Library for Web Workers

This directory contains the lamejs library for MP3 encoding in Web Workers.

## Setup Instructions

1. Copy the `lame.all.js` file from `node_modules/lamejs/lame.all.js` to this folder (`public/libs/lamejs/lame.all.js`).
2. No modifications to the file are needed, just a direct copy.

This setup is necessary because Web Workers cannot directly import npm modules, so we need to make the library publicly available.

## Implementation Note

The Web Worker in our audio converter loads this library using:

```javascript
importScripts('/libs/lamejs/lame.all.js');
```

This gives the worker access to a global `lamejs` object that contains the MP3 encoding functionality.
