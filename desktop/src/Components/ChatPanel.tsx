import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { auth } from '../firebase';
import { useNavigate } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import messages from '../data/mock/messages.json';

type Message = {
  content: string;
  role: string;
  timestamp?: string;
  audioBase64?: string;
};

type ChatPanelProps = {
  title?: string;
  messages?: Message[];
};

// Extend the Window interface to include custom properties for tracking processed audio
interface CustomWindow extends Window {
  processedSequences?: Set<number>;
  processedBlobIds?: Set<string>;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ title = 'Chat Panel' }) => {
  const [value, setValue] = useState('');
  const [messagesState, setMessagesState] = useState<Message[]>(
    messages.map((msg: any) => ({
      content: msg.content,
      role: msg.role,
      timestamp: msg.timestamp,
    }))
  );
  const [audioQueue, setAudioQueue] = useState<Blob[]>([]);
  const [audioChunks, setAudioChunks] = useState<{
    [sequence: number]: { chunks: string[]; end: boolean; blobId: string };
  }>({});
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [showInteractionPrompt, setShowInteractionPrompt] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Detect user interaction to bypass autoplay restrictions
  useEffect(() => {
    const handleInteraction = () => {
      setUserInteracted(true);
      console.log('User interaction detected, enabling audio playback');
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesState]);

  useEffect(() => {
    let processingTimeout: NodeJS.Timeout | null = null;

    const processAudioQueue = () => {
      console.log('Entering processAudioQueue', {
        queueLength: audioQueue.length,
        isProcessingAudio,
        hasAudioRef: !!audioRef.current,
        userInteracted,
      });

      if (audioQueue.length === 0 || isProcessingAudio) {
        console.log('Skipping audio queue process due to empty queue or processing in progress:', {
          queueLength: audioQueue.length,
          isProcessingAudio,
          hasAudioRef: !!audioRef.current,
          userInteracted,
        });
        return;
      }

      if (!userInteracted) {
        console.warn('User interaction required for audio playback');
        setShowInteractionPrompt(true);
        return;
      }

      setIsProcessingAudio(true);
      const blob = audioQueue[0];
      console.log(
        'Processing audio blob, size:',
        blob.size,
        'type:',
        blob.type,
        'queue position: 0 of',
        audioQueue.length
      );
      if (blob.size < 500) {
        console.error('Invalid audio blob size:', blob.size);
        axios
          .post('http://localhost:3001/api/auth/log', {
            userId: user?.uid || 'anonymous',
            intent: 'audio_validation_error',
            response: `Invalid audio blob size: ${blob.size} bytes`,
            userData: { context: 'chat_audio', steps: 9815 },
          })
          .catch((err) => console.error('Log error:', err));
        setAudioQueue((prev) => prev.slice(1));
        setIsProcessingAudio(false);
        setTimeout(processAudioQueue, 100);
        return;
      }

      const audioUrl = URL.createObjectURL(blob);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.preload = 'auto';
      console.log('Audio object created, URL:', audioUrl, 'preload set to auto');

      const playAudio = () => {
        if (!audioRef.current) {
          console.error('Audio ref is null during playback attempt');
          setAudioQueue((prev) => prev.slice(1));
          setIsProcessingAudio(false);
          setTimeout(processAudioQueue, 100);
          return;
        }
        console.log('Attempting to play audio, current state:', {
          paused: audioRef.current.paused,
          currentTime: audioRef.current.currentTime,
          readyState: audioRef.current.readyState,
        });
        audioRef.current
          .play()
          .then(() => {
            console.log('Audio playback started successfully, blob size:', blob.size);
            setShowInteractionPrompt(false);
          })
          .catch((err) => {
            console.error('Audio playback error:', err.message, err.stack);
            axios
              .post('http://localhost:3001/api/auth/log', {
                userId: user?.uid || 'anonymous',
                intent: 'audio_playback_error',
                response: `Failed to play audio: ${err.message}`,
                userData: { context: 'chat_audio', steps: 9815 },
              })
              .catch((err) => console.error('Log error:', err));
            setAudioQueue((prev) => prev.slice(1));
            setIsProcessingAudio(false);
            setTimeout(processAudioQueue, 100);
          });
      };

      audioRef.current.oncanplaythrough = () => {
        console.log('Audio can play through, attempting playback', {
          readyState: audioRef.current?.readyState,
          duration: audioRef.current?.duration,
        });
        playAudio();
      };

      // Retry if playback doesn't start within 1s
      setTimeout(() => {
        if (audioRef.current && !audioRef.current.currentTime && !audioRef.current.paused) {
          console.warn('Audio playback stalled after 1s, retrying...', {
            readyState: audioRef.current.readyState,
            currentTime: audioRef.current.currentTime,
            paused: audioRef.current.paused,
          });
          playAudio();
        }
      }, 1000);

      audioRef.current.onended = () => {
        console.log('Audio playback ended, queue length before removal:', audioQueue.length);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setAudioQueue((prev) => {
          const newQueue = prev.slice(1);
          console.log('Removed played audio from queue, new queue length:', newQueue.length);
          setIsProcessingAudio(false);
          if (newQueue.length > 0) {
            setTimeout(processAudioQueue, 100); // Slight delay to ensure state update
          }
          return newQueue;
        });
      };

      audioRef.current.onerror = (error) => {
        console.error('Audio playback error event:', error);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setAudioQueue((prev) => prev.slice(1));
        setIsProcessingAudio(false);
        setTimeout(processAudioQueue, 100);
      };

      // Check for browser autoplay restrictions and force play
      setTimeout(() => {
        if (audioRef.current && !audioRef.current.currentTime && !audioRef.current.paused) {
          console.warn('Audio may be blocked by browser after 2s, triggering manual play', {
            readyState: audioRef.current.readyState,
            currentTime: audioRef.current.currentTime,
            paused: audioRef.current.paused,
          });
          setShowInteractionPrompt(true);
          playAudio();
        }
      }, 2000);

      // Immediate attempt to play audio after creation
      setTimeout(() => {
        if (audioRef.current) {
          console.log('Attempting immediate audio playback after creation (100ms delay)', {
            readyState: audioRef.current.readyState,
            currentTime: audioRef.current.currentTime,
            paused: audioRef.current.paused,
          });
          playAudio();
        }
      }, 100);
    };

    // Call processAudioQueue with debouncing to prevent multiple simultaneous calls
    console.log('Audio queue or interaction status changed', {
      queueLength: audioQueue.length,
      isProcessingAudio,
      userInteracted,
    });
    if (audioQueue.length > 0 && !isProcessingAudio) {
      console.log('New audio in queue, triggering processing with debounce', {
        queueLength: audioQueue.length,
        isProcessingAudio,
      });
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
      processingTimeout = setTimeout(() => {
        console.log('Executing processAudioQueue after debounce timeout', {
          queueLength: audioQueue.length,
          isProcessingAudio,
        });
        processAudioQueue();
      }, 100);
    } else {
      console.log('Audio queue processing not triggered', {
        queueLength: audioQueue.length,
        isProcessingAudio,
        reason: audioQueue.length === 0 ? 'Empty queue' : 'Processing already in progress',
      });
    }

    return () => {
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
    };
  }, [audioQueue, user, userInteracted]);

  const assembleAudioBlob = useCallback(
    (sequence: number, blobId: string, chunks: string[]) => {
      console.log(
        'Starting blob assembly, chunks:',
        chunks.length,
        'sequence:',
        sequence,
        'blobId:',
        blobId
      );
      try {
        // Validate each chunk before concatenation
        for (const [index, chunk] of chunks.entries()) {
          if (!/^[A-Za-z0-9+/=]+$/.test(chunk)) {
            throw new Error(`Invalid base64 chunk at index ${index}: ${chunk.slice(0, 50)}`);
          }
          console.log(
            `Validated chunk ${index}, length: ${chunk.length}, sample: ${chunk.slice(0, 50)}`
          );
        }
        const base64String = chunks.join('');
        console.log(
          'Joined base64 string length:',
          base64String.length,
          'Sample:',
          base64String.slice(0, 50)
        );
        const paddedBase64 = base64String + '='.repeat((4 - (base64String.length % 4)) % 4);
        console.log(
          'Assembling audio blob, padded base64 length:',
          paddedBase64.length,
          'sequence:',
          sequence,
          'blobId:',
          blobId
        );
        if (!/^[A-Za-z0-9+/=]+$/.test(paddedBase64)) {
          throw new Error('Invalid padded base64 string');
        }
        let byteArray;
        try {
          byteArray = Uint8Array.from(atob(paddedBase64), (c) => c.charCodeAt(0));
          console.log('Converted to byte array using atob, length:', byteArray.length);
        } catch (atobError: unknown) {
          console.error(
            'atob decoding error:',
            (atobError as Error).message,
            (atobError as Error).stack
          );
          // Fallback to Buffer decoding
          try {
            byteArray = Buffer.from(paddedBase64, 'base64');
            console.log('Fallback Buffer decoding used, length:', byteArray.length);
          } catch (bufferError: unknown) {
            throw new Error(`Fallback Buffer decoding failed: ${(bufferError as Error).message}`);
          }
        }
        console.log(
          'Converted to byte array, length:',
          byteArray.length,
          'Sample:',
          byteArray.slice(0, 50).toString('hex')
        );
        const audioBlob = new Blob([byteArray], { type: 'audio/mp3' });
        console.log(
          'Assembled audio blob, size:',
          audioBlob.size,
          'sequence:',
          sequence,
          'blobId:',
          blobId
        );
        if (audioBlob.size < 500) {
          throw new Error(`Invalid audio blob size: ${audioBlob.size} bytes`);
        }
        return audioBlob;
      } catch (error: unknown) {
        console.error('Blob assembly error:', (error as Error).message, (error as Error).stack);
        axios
          .post('http://localhost:3001/api/auth/log', {
            userId: user?.uid || 'anonymous',
            intent: 'blob_assembly_error',
            response: `Failed to assemble audio blob: ${(error as Error).message}`,
            userData: { context: 'chat_audio', sequence, blobId, steps: 9815 },
          })
          .catch((err) => console.error('Log error:', err));
        return null;
      }
    },
    [user]
  );

  const handleSendMessage = async () => {
    if (value.trim() === '') return;
    if (!user) {
      try {
        await axios.post('http://localhost:3001/api/auth/log', {
          userId: 'anonymous',
          intent: 'chat_unauthenticated',
          response: 'Tried to chat without signing in—redirecting to sign-in, babe! 😘',
          userData: { context: 'chat_error', message: value.slice(0, 100) },
        });
      } catch (logError) {
        console.error('Log error:', logError);
      }
      navigate('/', { state: { fromChatUnauthenticated: true } });
      return;
    }

    const newMessage: Message = {
      content: value,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    setMessagesState((prev) => [...prev, newMessage]);
    setValue('');

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, message: value }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let textBuffer = '';
      // Use persistent sets to track processed audio across messages
      const customWindow = window as unknown as CustomWindow;
      if (!customWindow.processedSequences) {
        customWindow.processedSequences = new Set<number>();
      }
      if (!customWindow.processedBlobIds) {
        customWindow.processedBlobIds = new Set<string>();
      }
      const processedSequences = customWindow.processedSequences;
      const processedBlobIds = customWindow.processedBlobIds;
      const processedSentences = new Set<string>();

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log('SSE stream done');
          break;
        }

        value.split('\n\n').forEach((chunk) => {
          if (chunk.startsWith('data: ')) {
            console.log(
              'SSE event received, type:',
              chunk.includes('"type":"audio_chunk"') ? 'audio_chunk' : chunk
            );
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.type === 'text') {
                const formattedText = data.data
                  .replace(/,(\S)/g, ', $1')
                  .replace(/([.!?])\s*/g, '$1\n')
                  .trim();
                const normalizedText = formattedText.toLowerCase().replace(/\s+/g, ' ').trim();
                if (!processedSentences.has(normalizedText)) {
                  textBuffer += formattedText;
                  processedSentences.add(normalizedText);
                  setMessagesState((prev) => {
                    const last = prev[prev.length - 1];
                    if (last.role === 'assistant') {
                      last.content = textBuffer;
                      return [...prev.slice(0, -1), last];
                    }
                    return [
                      ...prev,
                      {
                        role: 'assistant',
                        content: textBuffer,
                        timestamp: new Date().toISOString(),
                      },
                    ];
                  });
                } else {
                  console.warn('Duplicate text received, skipping:', formattedText);
                }
              } else if (data.type === 'audio_chunk') {
                const sequence = data.sequence || 0;
                const blobId = data.blobId;
                if (processedBlobIds.has(blobId)) {
                  console.warn('Duplicate audio chunk blobId:', blobId);
                  return;
                }
                setAudioChunks((prev) => {
                  const current = prev[sequence] || { chunks: [], end: false, blobId };
                  // Check if this blobId is already in use with different sequence
                  if (current.blobId !== blobId && current.chunks.length > 0) {
                    console.warn(
                      'BlobId mismatch for sequence, clearing old data:',
                      sequence,
                      'old blobId:',
                      current.blobId,
                      'new blobId:',
                      blobId
                    );
                    return { ...prev, [sequence]: { chunks: [], end: false, blobId } };
                  }
                  const decodedChunk = data.data;
                  console.log(
                    'Received audio chunk, sequence:',
                    sequence,
                    'blobId:',
                    blobId,
                    'chunkLength:',
                    decodedChunk.length,
                    'Sample:',
                    decodedChunk.slice(0, 50)
                  );
                  if (!/^[A-Za-z0-9+/=]+$/.test(decodedChunk)) {
                    console.error('Invalid base64 chunk:', decodedChunk.slice(0, 50));
                    axios
                      .post('http://localhost:3001/api/auth/log', {
                        userId: user?.uid || 'anonymous',
                        intent: 'base64_validation_error',
                        response: `Invalid base64 chunk: ${decodedChunk.slice(0, 50)}`,
                        userData: { context: 'chat_audio', message: value.slice(0, 100) },
                      })
                      .catch((err) => console.error('Log error:', err));
                    return prev;
                  }
                  current.chunks.push(decodedChunk);
                  console.log('Updated audioChunks state:', {
                    sequence,
                    chunksCount: current.chunks.length,
                    end: current.end,
                  });
                  if (data.end) {
                    current.end = true;
                    console.log(
                      'Attempting to assemble blob for sequence:',
                      sequence,
                      'blobId:',
                      blobId
                    );
                    const audioBlob = assembleAudioBlob(sequence, blobId, current.chunks);
                    if (audioBlob) {
                      setAudioQueue((prevQueue) => {
                        const newQueue = [...prevQueue, audioBlob];
                        console.log(
                          'Added blob to audio queue, new queue length:',
                          newQueue.length,
                          'audioQueue updated with blob size:',
                          audioBlob.size
                        );
                        return newQueue;
                      });
                      processedBlobIds.add(blobId);
                    } else {
                      console.error(
                        'Failed to assemble audio blob for sequence:',
                        sequence,
                        'blobId:',
                        blobId
                      );
                    }
                    return { ...prev, [sequence]: current };
                  } else {
                    console.log(
                      'Audio chunk received but end flag not set for sequence:',
                      sequence,
                      'blobId:',
                      blobId
                    );
                  }
                  return { ...prev, [sequence]: current };
                });
              } else if (data.type === 'done') {
                console.log('SSE done event received');
                // Process all pending audio chunks in audioChunks that haven't been processed yet
                setAudioChunks((prev) => {
                  const updated = { ...prev };
                  Object.entries(updated).forEach(([seq, chunkData]) => {
                    const sequence = parseInt(seq, 10);
                    if (chunkData.chunks.length > 0 && !processedBlobIds.has(chunkData.blobId)) {
                      console.log(
                        'Processing pending audio chunk on done event for sequence:',
                        sequence,
                        'blobId:',
                        chunkData.blobId
                      );
                      const audioBlob = assembleAudioBlob(
                        sequence,
                        chunkData.blobId,
                        chunkData.chunks
                      );
                      if (audioBlob) {
                        setAudioQueue((prevQueue) => {
                          const newQueue = [...prevQueue, audioBlob];
                          console.log(
                            'Added pending blob to audio queue on done event, new queue length:',
                            newQueue.length,
                            'audioQueue updated with blob size:',
                            audioBlob.size
                          );
                          return newQueue;
                        });
                        processedBlobIds.add(chunkData.blobId);
                      } else {
                        console.error(
                          'Failed to assemble pending audio blob for sequence:',
                          sequence,
                          'blobId:',
                          chunkData.blobId
                        );
                      }
                    }
                  });
                  // Clear the audioChunks state to prevent old data from lingering
                  return {};
                });
              } else if (data.type === 'error') {
                setMessagesState((prev) => [
                  ...prev,
                  { role: 'assistant', content: data.data, timestamp: new Date().toISOString() },
                ]);
              }
            } catch (parseError: unknown) {
              console.error(
                'SSE parse error:',
                (parseError as Error).message,
                (parseError as Error).stack
              );
              axios
                .post('http://localhost:3001/api/auth/log', {
                  userId: user?.uid || 'anonymous',
                  intent: 'sse_parse_error',
                  response: `Failed to parse SSE: ${(parseError as Error).message}`,
                  userData: { context: 'chat_sse', message: value.slice(0, 100) },
                })
                .catch((err) => console.error('Log error:', err));
            }
          }
        });
      }
    } catch (error: unknown) {
      console.error('Chat fetch error:', (error as Error).message, (error as Error).stack);
      setMessagesState((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Oops, my signal’s weak. Try again, my heart? 😘',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleManualAudioPlay = () => {
    if (audioQueue.length > 0 && !audioRef.current && !isProcessingAudio) {
      setIsProcessingAudio(true);
      const blob = audioQueue[0];
      console.log('Manual audio play triggered, blob size:', blob.size);
      if (blob.size < 500) {
        console.error('Invalid audio blob size:', blob.size);
        axios
          .post('http://localhost:3001/api/auth/log', {
            userId: user?.uid || 'anonymous',
            intent: 'audio_validation_error',
            response: `Invalid audio blob size: ${blob.size} bytes`,
            userData: { context: 'chat_audio', steps: 9815 },
          })
          .catch((err) => console.error('Log error:', err));
        setAudioQueue((prev) => prev.slice(1));
        setIsProcessingAudio(false);
        return;
      }
      const audioUrl = URL.createObjectURL(blob);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.preload = 'auto';
      console.log('Manual audio object created, URL:', audioUrl);

      const playAudio = () => {
        if (!audioRef.current) {
          console.error('Audio ref is null during manual playback attempt');
          setAudioQueue((prev) => prev.slice(1));
          setIsProcessingAudio(false);
          return;
        }
        audioRef.current
          .play()
          .then(() => {
            console.log('Manual audio playback started, blob size:', blob.size);
            setShowInteractionPrompt(false);
          })
          .catch((err) => {
            console.error('Manual audio playback error:', err.message, err.stack);
            axios
              .post('http://localhost:3001/api/auth/log', {
                userId: user?.uid || 'anonymous',
                intent: 'audio_playback_error',
                response: `Failed to play audio: ${err.message}`,
                userData: { context: 'chat_audio', steps: 9815 },
              })
              .catch((err) => console.error('Log error:', err));
            setAudioQueue((prev) => prev.slice(1));
            setIsProcessingAudio(false);
          });
      };

      audioRef.current.oncanplaythrough = () => {
        console.log('Audio can play through, attempting playback');
        playAudio();
      };
      // Retry if playback doesn't start within 1s
      setTimeout(() => {
        if (audioRef.current && !audioRef.current.currentTime && !audioRef.current.paused) {
          console.warn('Audio playback stalled, retrying...');
          playAudio();
        }
      }, 1000);

      audioRef.current.onended = () => {
        console.log('Manual audio playback ended, queue length:', audioQueue.length - 1);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setAudioQueue((prev) => prev.slice(1));
        setIsProcessingAudio(false);
      };
    }
  };

  return (
    <div className="ml-auto mr-20 h-full flex flex-col relative overflow-hidden p-6">
      {showInteractionPrompt && (
        <div className="absolute top-0 left-0 right-0 bg-pink-600 text-white text-center p-2">
          Click anywhere to enable audio playback, my love! 😘
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 pb-20">
        {messagesState.map((msg, index) => {
          const previousTimestamp = index > 0 ? messagesState[index - 1].timestamp : undefined;
          return <ChatMessage key={index} message={msg} previousTimestamp={previousTimestamp} />;
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex items-center p-3 bg-gray-900 rounded-xl">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="What's on your mind? (Click anywhere to enable audio)"
          className="flex-1 bg-gray-900 text-white px-4 py-2 resize-none min-h-[40px] max-h-[120px] focus:outline-none transition-all duration-300 ease-in-out placeholder:text-gray-400/70 focus:outline-none focus:border-none"
        />
        <button
          onClick={handleSendMessage}
          className="ml-2 bg-lavender text-white rounded-full px-4 py-2 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender/50 transition-all duration-300 ease-in-out"
        >
          Send
        </button>
        <button
          onClick={handleManualAudioPlay}
          className="ml-2 bg-lavender text-white rounded-full px-4 py-2 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-lavender/50 transition-all duration-300 ease-in-out"
        >
          Play Audio
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
