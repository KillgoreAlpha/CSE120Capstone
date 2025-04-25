import { useState, useRef, useEffect, useCallback } from 'react';

export interface DictationResult {
  isListening: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export const useDictation = (): DictationResult => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }

      recorder.ondataavailable = (e: BlobEvent) => {
        audioChunksRef.current.push(e.data);
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 2000);
      };

      recorder.onstop = async () => {
        try {
          console.log('✋ Recording stopped, uploading', audioChunksRef.current);

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('file', audioBlob, 'dictation.webm');

          console.log('🔗 Sending audio to http://localhost:3000/api/transcribe');
          const response = await fetch('http://localhost:3000/api/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Transcription failed (${response.status}): ${text}`);
          }

          const data = await response.json();
          console.log('📝 Transcript from server:', data.transcript);
          setTranscript(data.transcript);
        } catch (err: any) {
          console.error('Error in onstop:', err);
          setError(err.message);
        } finally {
          stream.getTracks().forEach(track => track.stop());
          setIsListening(false);
          mediaRecorderRef.current = null;
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        }
      };

      recorder.onerror = (e: any) => {
        setError(e.error?.message || 'Recording error');
      };

      // Start recording and emit data chunks every 250ms for inactivity detection
      recorder.start(250);
      setIsListening(true);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const stop = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return { isListening, transcript, error, start, stop };
};