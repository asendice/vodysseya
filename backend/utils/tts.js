const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
const { Readable } = require('stream');

async function streamToBuffer(stream) {
  console.time('tts_stream_to_buffer');
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.timeEnd('tts_stream_to_buffer');
  return Buffer.concat(chunks);
}

async function generateDialogue(inputs, apiKey, options = {}) {
  console.time('tts_generate_total');
  if (!apiKey) {
    console.error('No ElevenLabs API key provided');
    return null;
  }
  const elevenlabs = new ElevenLabsClient({ apiKey });
  try {
    const dialogueInputs = Array.isArray(inputs)
      ? inputs
      : [
          {
            text: inputs ? inputs : '',
            voiceId: 'pBZVCk298iJlHAcHQwLr', // Forced stable voice
          },
        ];
    if (
      !dialogueInputs.length ||
      !dialogueInputs.every(
        (input) =>
          input && typeof input.text === 'string' && input.text.trim().length > 0 && input.voiceId
      )
    ) {
      console.log('Invalid dialogue inputs:', JSON.stringify(dialogueInputs));
      return null;
    }

    const text = dialogueInputs[0].text;
    const voiceId = 'pBZVCk298iJlHAcHQwLr'; // Forced stable voice

    try {
      const response = await elevenlabs.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_v3', // Updated to Eleven V3 model
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.5,
          style: 0.5,
          useSpeakerBoost: true,
        },
        outputFormat: 'mp3_22050_32',
      });
      console.log('TTS API response received for voiceId:', voiceId);
      const audioBuffer = await streamToBuffer(response);
      console.log(
        'Generated audio buffer size:',
        audioBuffer.length,
        'Sample:',
        audioBuffer.slice(0, 50).toString('hex')
      );
      if (audioBuffer.length < 500) {
        console.error(
          'Generated audio buffer too small:',
          audioBuffer.length,
          'Buffer sample:',
          audioBuffer.slice(0, 50).toString('hex')
        );
        return null;
      }
      const base64Audio = audioBuffer.toString('base64');
      console.log(
        'Base64 encoded audio length:',
        base64Audio.length,
        'Sample:',
        base64Audio.slice(0, 50)
      );
      return base64Audio;
    } catch (error) {
      console.error(
        'TTS conversion error for voiceId:',
        voiceId,
        'Error:',
        error.message,
        'Details:',
        JSON.stringify(error)
      );
      // Fallback to multilingual model
      try {
        const response = await elevenlabs.textToSpeech.convert(voiceId, {
          text,
          modelId: 'eleven_v3', // Updated to Eleven V3 model as fallback
          voiceSettings: {
            stability: 0.5,
            similarityBoost: 0.5,
            style: 0.5,
            useSpeakerBoost: true,
          },
          outputFormat: 'mp3_22050_32',
        });
        console.log('TTS fallback API response received for voiceId:', voiceId);
        const audioBuffer = await streamToBuffer(response);
        console.log(
          'Fallback audio buffer size:',
          audioBuffer.length,
          'Sample:',
          audioBuffer.slice(0, 50).toString('hex')
        );
        if (audioBuffer.length < 500) {
          console.error(
            'Fallback generated audio buffer too small:',
            audioBuffer.length,
            'Buffer sample:',
            audioBuffer.slice(0, 50).toString('hex')
          );
          return null;
        }
        const base64Audio = audioBuffer.toString('base64');
        console.log(
          'Fallback base64 encoded audio length:',
          base64Audio.length,
          'Sample:',
          base64Audio.slice(0, 50)
        );
        return base64Audio;
      } catch (fallbackError) {
        console.error(
          'TTS fallback error:',
          fallbackError.message,
          'Details:',
          JSON.stringify(fallbackError)
        );
        return null;
      }
    }
  } catch (error) {
    console.error('TTS SDK error:', error.message, 'Details:', JSON.stringify(error));
    return null;
  } finally {
    console.timeEnd('tts_generate_total');
  }
}

async function generateDialogueStream(inputs, apiKey, options = {}) {
  console.time('tts_generate_stream');
  if (!apiKey) {
    console.error('No ElevenLabs API key provided');
    return Readable.from([]);
  }
  const elevenlabs = new ElevenLabsClient({ apiKey });
  try {
    const dialogueInputs = Array.isArray(inputs)
      ? inputs
      : [
          {
            text: inputs ? inputs : '',
            voiceId: 'pBZVCk298iJlHAcHQwLr', // Forced stable voice
          },
        ];
    if (
      !dialogueInputs.length ||
      !dialogueInputs.every(
        (input) =>
          input && typeof input.text === 'string' && input.text.trim().length > 0 && input.voiceId
      )
    ) {
      console.log('Invalid dialogue inputs:', JSON.stringify(dialogueInputs));
      return Readable.from([]);
    }

    const text = dialogueInputs[0].text;
    const voiceId = 'pBZVCk298iJlHAcHQwLr'; // Forced stable voice

    try {
      const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_v3', // Updated to Eleven V3 model
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.5,
          style: 0.5,
          useSpeakerBoost: true,
        },
        outputFormat: 'mp3_22050_32',
      });
      console.timeEnd('tts_generate_stream');
      console.log('TTS stream started for voiceId:', voiceId);
      // Filter out small chunks to avoid invalid buffers
      const filteredStream = new Readable({
        read() {},
      });
      let buffer = Buffer.alloc(0);
      for await (const chunk of audioStream) {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length >= 500) {
          filteredStream.push(buffer);
          console.log(
            'Pushing audio chunk to stream, size:',
            buffer.length,
            'Sample:',
            buffer.slice(0, 50).toString('hex')
          );
          buffer = Buffer.alloc(0);
        }
      }
      if (buffer.length >= 500) {
        filteredStream.push(buffer);
        console.log(
          'Pushing final audio chunk to stream, size:',
          buffer.length,
          'Sample:',
          buffer.slice(0, 50).toString('hex')
        );
      } else if (buffer.length > 0) {
        console.warn(
          'Skipping small final buffer:',
          buffer.length,
          'Sample:',
          buffer.slice(0, 50).toString('hex')
        );
      }
      filteredStream.push(null);
      return filteredStream;
    } catch (error) {
      console.error(
        'TTS stream conversion error for voiceId:',
        voiceId,
        'Error:',
        error.message,
        'Details:',
        JSON.stringify(error)
      );
      // Fallback to multilingual model
      try {
        const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
          text,
          modelId: 'eleven_v3', // Updated to Eleven V3 model as fallback
          voiceSettings: {
            stability: 0.5,
            similarityBoost: 0.5,
            style: 0.5,
            useSpeakerBoost: true,
          },
          outputFormat: 'mp3_22050_32',
        });
        console.timeEnd('tts_generate_stream');
        console.log('TTS fallback stream started for voiceId:', voiceId);
        // Filter out small chunks
        const filteredStream = new Readable({
          read() {},
        });
        let buffer = Buffer.alloc(0);
        for await (const chunk of audioStream) {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length >= 500) {
            filteredStream.push(buffer);
            console.log(
              'Pushing audio chunk to stream, size:',
              buffer.length,
              'Sample:',
              buffer.slice(0, 50).toString('hex')
            );
            buffer = Buffer.alloc(0);
          }
        }
        if (buffer.length >= 500) {
          filteredStream.push(buffer);
          console.log(
            'Pushing final audio chunk to stream, size:',
            buffer.length,
            'Sample:',
            buffer.slice(0, 50).toString('hex')
          );
        } else if (buffer.length > 0) {
          console.warn(
            'Skipping small final buffer:',
            buffer.length,
            'Sample:',
            buffer.slice(0, 50).toString('hex')
          );
        }
        filteredStream.push(null);
        return filteredStream;
      } catch (fallbackError) {
        console.error(
          'TTS fallback error:',
          fallbackError.message,
          'Details:',
          JSON.stringify(fallbackError)
        );
        return Readable.from([]);
      }
    }
  } catch (error) {
    console.error('TTS stream error:', error.message, 'Details:', JSON.stringify(error));
    return Readable.from([]);
  }
}

module.exports = { generateDialogue, generateDialogueStream };
