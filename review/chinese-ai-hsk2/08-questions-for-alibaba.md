# Questions to settle about the Alibaba (Qwen) connection

These are about Alibaba's service, not about Chinese. Ask Alibaba Cloud's documentation, their support chat, or Qwen itself (Qwen may not know current details, so check any answer against the Model Studio documentation).
The site calls the International (Singapore) endpoint straight from the browser, and has only been tested against a fake Alibaba server.

1. CORS: can a web page (https://alvinyu20.github.io, no server of mine) call `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions` and `https://{workspace}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions` directly with an `Authorization: Bearer <key>` header? Do those endpoints answer the browser's preflight (OPTIONS) request and send `Access-Control-Allow-Origin`? If not, what is the supported way to call Qwen from a static page?
2. Model names: are `qwen-flash` and `qwen-plus` current model names on the International endpoint? Which model is the best for short Mandarin conversation for a beginner at the lowest cost?
3. Voice recognition: is `qwen3-asr-flash` available through `/compatible-mode/v1/chat/completions` with an `input_audio` content part holding a base64 data URI (`data:audio/wav;base64,...`, 16 kHz mono)? Are other formats (webm/opus from a browser MediaRecorder) accepted directly? What is the maximum audio length and file size?
4. Is there a language hint (for example Mandarin only) for the recogniser, and does it return punctuation?
5. Free quota: how many free tokens or audio minutes does a new International account get, for how long, and what happens when it runs out (an error, or automatic charging)? Is there a spending limit I can set so nothing is charged by surprise?
6. Key safety: the key sits in the browser's local storage on my own device. Can I limit a key to certain models or set a per-key budget?
7. Which region should a key be created in so it works with the endpoints above (Singapore)? What does the workspace ID do, and is it needed?
8. Anything that changed recently in the terms for using these models for a personal learning site?
