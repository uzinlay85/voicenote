document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const recordBtn = document.getElementById('record-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const audioUploadInput = document.getElementById('audio-upload-input');
    const statusText = document.getElementById('status-text');
    const transcriptionArea = document.getElementById('transcription-area');
    
    const transcriptionContent = document.getElementById('transcription-content');
    const placeholderText = document.getElementById('placeholder-text');
    const copyBtn = document.getElementById('copy-btn');

    // NEW: Notification elements
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    const notificationCloseBtn = document.getElementById('notification-close-btn');

    // Settings Modal elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const apiKeyInput = document.getElementById('api-key');

    // --- State Variables ---
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';

    if (geminiApiKey) {
        apiKeyInput.value = geminiApiKey;
    }

    // --- Event Listeners ---
    recordBtn.addEventListener('click', toggleRecording);
    uploadBtn.addEventListener('click', () => audioUploadInput.click());
    audioUploadInput.addEventListener('change', handleFileUpload);

    // NEW: Close notification listener
    notificationCloseBtn.addEventListener('click', () => {
        notification.classList.remove('show');
    });

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

    // --- NEW: Notification Function ---
    function showNotification(message) {
        notificationText.textContent = message;
        notification.classList.add('show');
    }

    function checkApiKey() {
        if (!geminiApiKey) {
            showNotification('Setting သို့ဝင်၍ Gemini API key ထည့်သွင်းရန် လိုအပ်ပါသည်။');
            settingsModal.style.display = 'block'; // Also open settings modal
            return false;
        }
        notification.classList.remove('show'); // Hide notification if key exists
        return true;
    }

    function processUploadedFile(file) {
        if (!checkApiKey()) return;
        processAudio(file);
    }

    async function toggleRecording() {
        if (!checkApiKey()) return;
        isRecording ? stopRecording() : await startRecording();
    }

    // ... (rest of the event listeners and functions remain the same)
    
    // --- All other functions like handleDragEvent, handleFileUpload, startRecording, etc. remain the same ---
    // Make sure to replace the old processUploadedFile and toggleRecording functions with the ones above.
    
    // (The full script is long, so only the key changes are highlighted. 
    // You should add the new element references and functions, and update the functions that check for the API key.)
});
