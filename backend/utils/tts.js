const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');

// Helper to convert ReadableStream to Buffer
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function generateDialogue(inputs, apiKey, options = {}) {
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
            voiceId: options.voice || 'uYXf8XasLslADfZ2MB4u', // Podcast Tone girl
          },
        ];

    console.log('Dialogue Inputs:', JSON.stringify(dialogueInputs));
    console.log('Dialogue Inputs:', dialogueInputs);

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
        style: 0.5, // Flirty Ani vibe
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
  }
}

module.exports = { generateDialogue };
