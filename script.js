document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const recordBtn = document.getElementById('record-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const audioUploadInput = document.getElementById('audio-upload-input');
    const statusText = document.getElementById('status-text');
    const transcriptionArea = document.getElementById('transcription-area');
    
    // UPDATED: Back to single content area
    const transcriptionContent = document.getElementById('transcription-content');
    const placeholderText = document.getElementById('placeholder-text');
    const copyBtn = document.getElementById('copy-btn');

    // Settings Modal elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const apiKeyInput = document.getElementById('api-key');

    // --- State Variables ---
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';

    if (geminiApiKey) {
        apiKeyInput.value = geminiApiKey;
    }

    // --- Event Listeners ---
    recordBtn.addEventListener('click', toggleRecording);
    uploadBtn.addEventListener('click', () => audioUploadInput.click());
    audioUploadInput.addEventListener('change', handleFileUpload);

    // Drag and Drop Event Listeners
    transcriptionArea.addEventListener('dragenter', handleDragEvent);
    transcriptionArea.addEventListener('dragover', handleDragEvent);
    transcriptionArea.addEventListener('dragleave', handleDragLeave);
    transcriptionArea.addEventListener('drop', handleDrop);

    copyBtn.addEventListener('click', () => {
        const textToCopy = transcriptionContent.textContent;
        if (textToCopy && textToCopy !== placeholderText.textContent) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                alert('Copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy text.');
            });
        }
    });

    function handleDragEvent(e) {
        e.preventDefault();
        e.stopPropagation();
        transcriptionArea.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        transcriptionArea.classList.remove('drag-over');
    }

    function handleDrop(e) {
        handleDragLeave(e);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('audio/')) {
                processUploadedFile(file);
            } else {
                alert('Please drop an audio file.');
            }
        }
    }

    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            processUploadedFile(file);
            audioUploadInput.value = '';
        }
    }
    
    function processUploadedFile(file) {
        if (!geminiApiKey) {
            alert('Please set your Gemini API Key in the settings first.');
            settingsModal.style.display = 'block';
            return;
        }
        processAudio(file);
    }

    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
    closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == settingsModal) settingsModal.style.display = 'none';
    });
    saveSettingsBtn.addEventListener('click', () => {
        geminiApiKey = apiKeyInput.value.trim();
        if (geminiApiKey) {
            localStorage.setItem('gemini_api_key', geminiApiKey);
            settingsModal.style.display = 'none';
            alert('Settings saved!');
        } else {
            alert('Please enter a valid API Key.');
        }
    });

    // --- Core Functions ---
    async function toggleRecording() {
        if (!geminiApiKey) {
            alert('Please set your Gemini API Key in the settings first.');
            settingsModal.style.display = 'block';
            return;
        }
        isRecording ? stopRecording() : await startRecording();
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.onstart = () => {
                isRecording = true;
                audioChunks = [];
                recordBtn.classList.add('recording');
                recordBtn.querySelector('i').className = 'fa-solid fa-stop';
                statusText.textContent = 'Recording...';
                placeholderText.style.display = 'none';
                transcriptionContent.textContent = '';
                copyBtn.style.display = 'none';
            };

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);

            mediaRecorder.onstop = async () => {
                isRecording = false;
                recordBtn.classList.remove('recording');
                recordBtn.querySelector('i').className = 'fa-solid fa-microphone';
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                await processAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            statusText.textContent = 'Error: Could not access microphone.';
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // UPDATED: processAudio to show final result in one box
    async function processAudio(audioData) {
        placeholderText.style.display = 'none';
        transcriptionContent.textContent = '';
        copyBtn.style.display = 'none';
        statusText.textContent = 'Processing... (Step 1 of 2)';

        try {
            // Step 1: Get raw transcription (in the background)
            const rawText = await transcribeAudioWithGemini(audioData);
            if (!rawText) {
                statusText.textContent = 'Could not transcribe audio. Please try again.';
                transcriptionContent.appendChild(placeholderText);
                placeholderText.style.display = 'block';
                return;
            }
            
            // Step 2: Get proofread text (in the background)
            statusText.textContent = 'Refining text... (Step 2 of 2)';
            const proofreadText = await proofreadTextWithGemini(rawText);
            
            // Final Step: Display the single, corrected result
            transcriptionContent.textContent = proofreadText;
            statusText.textContent = 'Transcription complete.';
            copyBtn.style.display = 'flex';

        } catch (error) {
            console.error('Error during processing:', error);
            statusText.textContent = `Error: ${error.message}`;
        }
    }

    async function transcribeAudioWithGemini(audioData) {
        const base64Audio = await blobToBase64(audioData);
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        
        const prompt = "Transcribe the following audio. The primary language is Burmese (Myanmar ), but it may contain a few English words. Please keep the English words in their original English form.";
        const mimeType = audioData.type || 'audio/webm';

        const requestBody = {
            "contents": [{"parts": [{"text": prompt}, {"inline_data": {"mime_type": mimeType, "data": base64Audio}}]}]
        };
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    async function proofreadTextWithGemini(text) {
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;
        
        const prompt = `
You are an expert editor specializing in the Burmese (Myanmar ) language. Your task is to correct and refine the following text, which was transcribed from speech. Follow these rules strictly:

1.  **Primary Goal:** Improve the text to meet a high standard of written Burmese, as if for a formal document or publication.
2.  **Spelling Correction:** Correct all Burmese spelling mistakes according to the official Myanmar Language Commission dictionary.
3.  **Punctuation:**
    *   Use '။' (ပုဒ်မ) to end sentences.
    *   Use '၊' (ပုဒ်ဖြတ်) where appropriate for pauses within sentences.
    *   Remove unnecessary spaces before or after punctuation.
4.  **Grammar and Flow:**
    *   Correct grammatical errors.
    *   Improve sentence structure for better readability and flow, but only if necessary.
    *   Choose more appropriate or formal vocabulary where it enhances clarity (e.g., change "လုပ်တယ်" to "ဆောင်ရွက်သည်" in a formal context), but be careful not to alter the core meaning.
5.  **Strict Constraints:**
    *   **DO NOT** change the original meaning or intent of the sentences. Your role is to correct and refine, not to rewrite.
    *   **DO NOT** translate or alter any English words or technical terms present in the text. Keep them as they are.
    *   **DO NOT** add any comments, explanations, or introductory phrases to your response.
6.  **Output:** Provide only the fully corrected and refined Burmese text as the final output.

Here is the text to be corrected:
"${text}"
`;

        const requestBody = {
            "contents": [{"parts": [{"text": prompt}]}]
        };
        
        const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
        const data = await response.json();
        
        return data.candidates?.[0]?.content?.parts?.[0]?.text.trim() || text;
    }
});
