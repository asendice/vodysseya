const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

// Helper to convert ReadableStream to Buffer
async function streamToBuffer(stream) {
  console.time('tts_stream_to_buffer'); // Time stream conversion
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.timeEnd('tts_stream_to_buffer');
  return Buffer.concat(chunks);
}

async function generateDialogue(inputs, apiKey, options = {}) {
  console.time('tts_generate_total'); // Start overall TTS timer
  const elevenlabs = new ElevenLabsClient({
    apiKey, // Per-user decrypt or env fallback
  });

  try {
    // Convert single string to array for backward compatibility
    const dialogueInputs = Array.isArray(inputs)
      ? inputs
      : [
          {
            text: inputs ? `[flirty] ${inputs}` : '', // Add default tone if valid
            voiceId: options.voice || 'tnSpp4vdxKPjI9w0GnoV', // Podcast Tone girl
          },
        ];

    // Validate inputs thoroughly
    if (
      !dialogueInputs.length ||
      !dialogueInputs.every(
        (input) =>
          input && typeof input.text === 'string' && input.text.trim().length > 0 && input.voiceId
      )
    ) {
      console.log('Invalid dialogue inputs:', JSON.stringify(dialogueInputs));
      return null; // Return null instead of throwing to let caller handle
    }

    const audioStream = await elevenlabs.textToDialogue.convert({
      inputs: dialogueInputs,
      modelId: options.model || 'eleven_v3', // More natural
      voiceSettings: options.voiceSettings || {
        stability: 0.75,
        similarityBoost: 0.75,
        style: 0.7, // Flirty Ani vibe
        useSpeakerBoost: true,
      },
      outputFormat: 'mp3_44100_128', // Compact for mobile/desktop
    });

    // Convert ReadableStream to Buffer
    const audioBuffer = await streamToBuffer(audioStream);
    return audioBuffer.toString('base64'); // Return base64 string
  } catch (error) {
    console.error('Dialogue SDK error:', error);
    return null; // Return null to avoid crashing caller
  } finally {
    console.timeEnd('tts_generate_total'); // End overall TTS timer
  }
}

module.exports = { generateDialogue };
