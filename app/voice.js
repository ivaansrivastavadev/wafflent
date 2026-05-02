/* ═══════════════════════════════════════════════════════════════
   VOICE MESSAGE RECORDING & PLAYBACK
   ═══════════════════════════════════════════════════════════════ */

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isPaused = false;
let recordingStartTime = null;
let recordingTimer = null;
let currentRecordingDuration = 0;
let recordingPauseTime = 0;
let shouldSendRecording = true;
let manualMode = false; // Manual mode allows listening before sending

// Track gesture state
let touchStartX = 0;
let touchStartY = 0;
let recordingElement = null;
let lastTouchX = 0;
let lastTouchY = 0;

/* ─── Hold-to-record setup ─── */
function setupVoiceRecording() {
  const voiceBtn = $('voiceBtn');
  
  // Mouse events for desktop
  voiceBtn.addEventListener('mousedown', handleVoiceMouseDown);
  voiceBtn.addEventListener('mouseup', handleVoiceMouseUp);
  voiceBtn.addEventListener('mouseleave', handleVoiceMouseLeave);
  
  // Touch events for mobile
  voiceBtn.addEventListener('touchstart', handleVoiceTouchStart, { passive: false });
  voiceBtn.addEventListener('touchend', handleVoiceTouchEnd, { passive: false });
  voiceBtn.addEventListener('touchmove', handleVoiceTouchMove, { passive: false });
}

let holdTimer = null;
let isHolding = false;

function handleVoiceMouseDown(e) {
  e.preventDefault();
  touchStartX = e.clientX;
  touchStartY = e.clientY;
  isHolding = false;
  
  holdTimer = setTimeout(() => {
    if (!isRecording) {
      toast('Hold to record');
      isHolding = true;
      startVoiceRecording();
    }
  }, 200);
}

function handleVoiceMouseUp(e) {
  e.preventDefault();
  clearTimeout(holdTimer);
  
  if (isRecording && isHolding) {
    const deltaX = e.clientX - touchStartX;
    const deltaY = e.clientY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Release at same spot (< 20px movement) - send recording
    if (distance < 20) {
      stopVoiceRecording();
    }
    // Slide left to delete
    else if (deltaX < -80) {
      cancelVoiceRecording();
    }
    // Slide up to manual mode
    else if (deltaY < -80) {
      enterManualMode();
    }
    // Any other gesture - just stop
    else {
      stopVoiceRecording();
    }
  }
}

function handleVoiceMouseLeave(e) {
  e.preventDefault();
  clearTimeout(holdTimer);
}

function handleVoiceTouchStart(e) {
  e.preventDefault();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHolding = false;
  
  holdTimer = setTimeout(() => {
    if (!isRecording) {
      toast('Hold to record');
      isHolding = true;
      startVoiceRecording();
    }
  }, 200);
}

function handleVoiceTouchEnd(e) {
  e.preventDefault();
  clearTimeout(holdTimer);
  
  if (isRecording && isHolding) {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Release at same spot (< 20px movement) - send recording
    if (distance < 20) {
      stopVoiceRecording();
    }
    // Slide left to delete
    else if (deltaX < -80) {
      cancelVoiceRecording();
    }
    // Slide up to manual mode
    else if (deltaY < -80) {
      enterManualMode();
    }
    // Any other gesture - just stop
    else {
      stopVoiceRecording();
    }
  }
}

function handleVoiceTouchMove(e) {
  if (!isRecording || !isHolding) return;
  
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const deltaX = currentX - touchStartX;
  const deltaY = currentY - touchStartY;
  
  // Update recording UI to show gesture feedback
  if (recordingElement) {
    if (deltaX < -80) {
      // Show delete hint
      recordingElement.style.opacity = '0.5';
      recordingElement.style.transform = `translateX(${Math.min(deltaX, -80)}px)`;
    } else if (deltaY < -80) {
      // Show pause hint
      recordingElement.style.transform = `translateY(${Math.min(deltaY, -80)}px)`;
    } else {
      recordingElement.style.opacity = '1';
      recordingElement.style.transform = 'none';
    }
  }
}

/* ─── Initialize voice recording ─── */
async function startVoiceRecording() {
  try {
    if (isRecording) return;
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;
    isPaused = false;
    recordingStartTime = Date.now();
    currentRecordingDuration = 0;
    recordingPauseTime = 0;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      isPaused = false;
      clearInterval(recordingTimer);
      
      // Only send if not canceled
      if (!shouldSendRecording) {
        restoreMessageBar();
        shouldSendRecording = true;
        return;
      }
      
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        
        // If in manual mode, show manual review UI instead of sending
        if (manualMode) {
          manualMode = false;
          showManualReviewUI(dataUrl);
          restoreMessageBar();
          return;
        }
        
        const duration = currentRecordingDuration;
        await sendVoiceMessage(dataUrl, duration);
      };
      
      reader.readAsDataURL(audioBlob);
      
      if (!manualMode) {
        restoreMessageBar();
        shouldSendRecording = true;
      }
    };

    mediaRecorder.start();
    updateRecordingUI(true);
    replaceMessageBarWithRecording();
    startRecordingTimer();
    
  } catch (err) {
    console.error('Error accessing microphone:', err);
    toast('Unable to access microphone. Please check permissions.');
    isRecording = false;
  }
}

function pauseVoiceRecording() {
  if (!isRecording || !mediaRecorder || isPaused) return;
  
  mediaRecorder.pause();
  isPaused = true;
  recordingPauseTime = Date.now();
  clearInterval(recordingTimer);
  updateRecordingBar();
  
  if (recordingElement) {
    const pauseBtn = recordingElement.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }
}

function resumeVoiceRecording() {
  if (!isRecording || !mediaRecorder || !isPaused) return;
  
  mediaRecorder.resume();
  isPaused = false;
  recordingStartTime += (Date.now() - recordingPauseTime);
  startRecordingTimer();
  updateRecordingBar();
  
  if (recordingElement) {
    const pauseBtn = recordingElement.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }
}

function startRecordingTimer() {
  recordingTimer = setInterval(() => {
    currentRecordingDuration = Math.floor((Date.now() - recordingStartTime) / 1000);
    updateRecordingBar();
  }, 100);
}

function updateRecordingBar() {
  if (!recordingElement) return;
  
  const durationDisplay = recordingElement.querySelector('[data-display="duration"]');
  if (durationDisplay) {
    const mins = Math.floor(currentRecordingDuration / 60);
    const secs = currentRecordingDuration % 60;
    const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
    durationDisplay.textContent = display;
  }
}

function stopVoiceRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
  updateRecordingUI(false);
}

function enterManualMode() {
  if (!isRecording || !mediaRecorder) return;
  
  // Stop recording but don't send yet
  manualMode = true;
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
  
  // Wait for onstop to process the recording
}

function pauseVoiceRecording() {
  if (!isRecording || !mediaRecorder || isPaused) return;
  
  mediaRecorder.pause();
  isPaused = true;
  recordingPauseTime = Date.now();
  clearInterval(recordingTimer);
  updateRecordingBar();
  
  if (recordingElement) {
    const pauseBtn = recordingElement.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }
}

function resumeVoiceRecording() {
  if (!isRecording || !mediaRecorder || !isPaused) return;
  
  mediaRecorder.resume();
  isPaused = false;
  recordingStartTime += (Date.now() - recordingPauseTime);
  startRecordingTimer();
  updateRecordingBar();
  
  if (recordingElement) {
    const pauseBtn = recordingElement.querySelector('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  }
}

function cancelVoiceRecording() {
  if (!isRecording || !mediaRecorder) return;
  
  shouldSendRecording = false;
  manualMode = false;
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(track => track.stop());
  audioChunks = [];
  isRecording = false;
  isPaused = false;
  currentRecordingDuration = 0;
  clearInterval(recordingTimer);
  
  updateRecordingUI(false);
  toast('Recording cancelled');
}

function replaceMessageBarWithRecording() {
  const inputBar = document.querySelector('.lcg-inputbar');
  if (!inputBar) return;
  
  // Hide the original input bar
  inputBar.style.display = 'none';
  
  // Create recording UI
  const recordingContainer = document.createElement('div');
  recordingContainer.id = 'recordingContainer';
  recordingContainer.style.cssText = `
    position: fixed;
    bottom: 14px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-elevated);
    border: 1.5px solid var(--border);
    border-radius: var(--r-pill);
    z-index: 100;
    cursor: grab;
    user-select: none;
    touch-action: none;
    transition: opacity 150ms ease, transform 150ms ease;
  `;
  
  // Microphone icon
  const micIcon = document.createElement('div');
  micIcon.innerHTML = '<i class="fas fa-microphone"></i>';
  micIcon.style.cssText = `
    font-size: 18px;
    color: var(--accent);
    animation: pulse-mic 1.5s infinite;
  `;
  
  // Duration display
  const durationDisplay = document.createElement('div');
  durationDisplay.setAttribute('data-display', 'duration');
  durationDisplay.textContent = '0s';
  durationDisplay.style.cssText = `
    font-family: monospace;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 40px;
    text-align: center;
  `;
  
  // Pause button
  const pauseBtn = document.createElement('button');
  pauseBtn.setAttribute('data-action', 'pause');
  pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  pauseBtn.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    background: var(--bg-base);
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 120ms ease;
  `;
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isPaused) {
      resumeVoiceRecording();
    } else {
      pauseVoiceRecording();
    }
  });
  
  pauseBtn.addEventListener('mouseenter', () => {
    pauseBtn.style.borderColor = 'var(--accent)';
    pauseBtn.style.background = 'var(--accent-subtle)';
  });
  pauseBtn.addEventListener('mouseleave', () => {
    pauseBtn.style.borderColor = 'var(--border)';
    pauseBtn.style.background = 'var(--bg-base)';
  });
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
  deleteBtn.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid var(--error-subtle);
    background: var(--error-subtle);
    color: var(--error);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 120ms ease;
  `;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cancelVoiceRecording();
  });
  
  deleteBtn.addEventListener('mouseenter', () => {
    deleteBtn.style.borderColor = 'var(--error)';
    deleteBtn.style.background = 'var(--error)';
    deleteBtn.style.color = 'white';
  });
  deleteBtn.addEventListener('mouseleave', () => {
    deleteBtn.style.borderColor = 'var(--error-subtle)';
    deleteBtn.style.background = 'var(--error-subtle)';
    deleteBtn.style.color = 'var(--error)';
  });
  
  // Send button
  const sendBtn = document.createElement('button');
  sendBtn.innerHTML = '<i class="fas fa-check"></i>';
  sendBtn.style.cssText = `
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1.5px solid var(--success);
    background: var(--success);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 120ms ease;
  `;
  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    stopVoiceRecording();
  });
  
  sendBtn.addEventListener('mouseenter', () => {
    sendBtn.style.opacity = '0.8';
  });
  sendBtn.addEventListener('mouseleave', () => {
    sendBtn.style.opacity = '1';
  });
  
  recordingContainer.appendChild(micIcon);
  recordingContainer.appendChild(durationDisplay);
  recordingContainer.appendChild(pauseBtn);
  recordingContainer.appendChild(deleteBtn);
  recordingContainer.appendChild(sendBtn);
  
  document.body.appendChild(recordingContainer);
  recordingElement = recordingContainer;
}

function restoreMessageBar() {
  const inputBar = document.querySelector('.lcg-inputbar');
  if (inputBar) {
    inputBar.style.display = 'flex';
  }
  
  const recordingContainer = document.getElementById('recordingContainer');
  if (recordingContainer) {
    recordingContainer.style.animation = 'fade-out 200ms ease forwards';
    setTimeout(() => {
      if (recordingContainer.parentNode) {
        recordingContainer.parentNode.removeChild(recordingContainer);
      }
      recordingElement = null;
    }, 200);
  }
}

function showManualReviewUI(audioDataUrl) {
  const duration = currentRecordingDuration;
  
  // Hide input bar and create review panel
  const inputBar = document.querySelector('.lcg-inputbar');
  if (inputBar) {
    inputBar.style.display = 'none';
  }
  
  const reviewContainer = document.createElement('div');
  reviewContainer.id = 'manualReviewContainer';
  reviewContainer.style.cssText = `
    position: fixed;
    bottom: 14px;
    left: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--bg-elevated);
    border: 1.5px solid var(--border);
    border-radius: var(--r-lg);
    z-index: 100;
    max-width: 600px;
    margin: 0 auto;
  `;
  
  // Duration and info
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  `;
  infoDiv.innerHTML = `
    <i class="fas fa-microphone" style="color: var(--accent);"></i>
    <span id="reviewDuration" style="font-family: monospace; font-weight: 600;">${formatDuration(duration)}</span>
    <span>·</span>
    <span>Drag to trim or click to play</span>
  `;
  
  // Audio player with timeline
  const playerDiv = document.createElement('div');
  playerDiv.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
  
  const audio = document.createElement('audio');
  audio.src = audioDataUrl;
  audio.style.cssText = `
    width: 100%;
    height: 40px;
    accent-color: var(--accent);
  `;
  
  // Trim controls
  const trimDiv = document.createElement('div');
  trimDiv.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  `;
  trimDiv.innerHTML = `
    <span id="trimStart">0:00</span>
    <div style="flex: 1; height: 2px; background: var(--border); border-radius: 1px;"></div>
    <span id="trimEnd">${formatDuration(duration)}</span>
  `;
  
  playerDiv.appendChild(audio);
  playerDiv.appendChild(trimDiv);
  
  // Action buttons
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  `;
  
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
  cancelBtn.style.cssText = `
    padding: 8px 12px;
    border-radius: var(--r-md);
    border: 1.5px solid var(--border);
    background: var(--bg-base);
    color: var(--text-secondary);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all 120ms ease;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  cancelBtn.addEventListener('click', () => {
    exitManualReview();
  });
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.borderColor = 'var(--error)';
    cancelBtn.style.color = 'var(--error)';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.borderColor = 'var(--border)';
    cancelBtn.style.color = 'var(--text-secondary)';
  });
  
  // Send button
  const sendBtn = document.createElement('button');
  sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send';
  sendBtn.style.cssText = `
    padding: 8px 12px;
    border-radius: var(--r-md);
    border: none;
    background: var(--accent);
    color: white;
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all 120ms ease;
    display: flex;
    align-items: center;
    gap: 6px;
  `;
  sendBtn.addEventListener('click', async () => {
    // Calculate trimmed duration
    const startTime = audio.currentTime;
    const trimmedDuration = Math.max(0, duration - startTime);
    exitManualReview();
    await sendVoiceMessage(audioDataUrl, trimmedDuration);
  });
  sendBtn.addEventListener('mouseenter', () => {
    sendBtn.style.opacity = '0.9';
  });
  sendBtn.addEventListener('mouseleave', () => {
    sendBtn.style.opacity = '1';
  });
  
  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(sendBtn);
  
  reviewContainer.appendChild(infoDiv);
  reviewContainer.appendChild(playerDiv);
  reviewContainer.appendChild(buttonsDiv);
  
  document.body.appendChild(reviewContainer);
  recordingElement = reviewContainer;
  
  toast('Slide up to exit review');
}

function exitManualReview() {
  const reviewContainer = document.getElementById('manualReviewContainer');
  if (reviewContainer) {
    reviewContainer.style.animation = 'fade-out 200ms ease forwards';
    setTimeout(() => {
      if (reviewContainer.parentNode) {
        reviewContainer.parentNode.removeChild(reviewContainer);
      }
    }, 200);
  }
  
  const inputBar = document.querySelector('.lcg-inputbar');
  if (inputBar) {
    inputBar.style.display = 'flex';
  }
  recordingElement = null;
  isRecording = false;
  updateRecordingUI(false);
}


function updateRecordingUI(recording) {
  const voiceBtn = $('voiceBtn');
  
  if (recording) {
    voiceBtn.classList.add('recording');
    voiceBtn.title = 'Recording...';
  } else {
    voiceBtn.classList.remove('recording');
    voiceBtn.title = 'Hold to record';
  }
}

async function sendVoiceMessage(dataUrl, duration) {
  if (!roomId) { toast('Join a room first'); return; }
  if (!roomNode) { toast('Room not connected, please try joining again'); return; }

  const uid = crypto.randomUUID();
  
  const encryptedData = await enc(dataUrl);
  const encryptedDuration = await enc(String(duration));
  
  const payload = {
    uid,
    from: deviceId,
    fromName: getDisplayName() || 'Anonymous',
    ts: Date.now(),
    type: 'voice',
    data: encryptedData,
    duration: encryptedDuration
  };

  seen.add(uid);
  renderVoice({ me: true, src: dataUrl, ts: payload.ts, from: deviceId, name: getDisplayName(), duration, uid, status: 'sending' });
  
  roomNode.get('messages').set(payload);
  
  setTimeout(() => updateMessageStatus(uid, 'sent'), 100);
  
  toast('Voice message sent!', 2000);
}

/* ─── Render voice message ─── */
function renderVoice({ me, src, ts, from, name, duration = 0, uid, status = 'sent' }) {
  const box = document.createElement('div');
  box.className = 'lcg-msg ' + (me ? 'me' : 'them');
  if (uid) box.setAttribute('data-uid', uid);

  const senderLabel = !me ? (name || 'id ' + (from || '–').slice(0, 8)) : null;

  // Create voice player container
  const voiceContainer = document.createElement('div');
  voiceContainer.className = 'lcg-voice-container';
  voiceContainer.style.display = 'flex';
  voiceContainer.style.alignItems = 'center';
  voiceContainer.style.gap = '12px';
  voiceContainer.style.padding = '12px 16px';
  voiceContainer.style.borderRadius = 'var(--r-md)';
  voiceContainer.style.background = me ? 'rgba(255,255,255,0.1)' : 'var(--accent)';
  voiceContainer.style.minWidth = '180px';
  voiceContainer.style.maxWidth = '280px';

  // Play button
  const playBtn = document.createElement('button');
  playBtn.className = 'lcg-voice-play-btn';
  playBtn.innerHTML = '<i class="fas fa-play"></i>';
  playBtn.style.width = '44px';
  playBtn.style.height = '44px';
  playBtn.style.borderRadius = '50%';
  playBtn.style.border = 'none';
  playBtn.style.background = me ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)';
  playBtn.style.color = 'inherit';
  playBtn.style.cursor = 'pointer';
  playBtn.style.fontSize = '14px';
  playBtn.style.display = 'flex';
  playBtn.style.alignItems = 'center';
  playBtn.style.justifyContent = 'center';
  playBtn.style.flexShrink = '0';
  playBtn.style.transition = 'background 120ms ease';

  playBtn.addEventListener('mouseover', () => {
    playBtn.style.background = me ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.35)';
  });
  playBtn.addEventListener('mouseout', () => {
    playBtn.style.background = me ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)';
  });

  // Duration display
  const durationDiv = document.createElement('div');
  durationDiv.className = 'lcg-voice-duration';
  durationDiv.style.fontSize = '13px';
  durationDiv.style.fontWeight = '500';
  durationDiv.style.fontFamily = 'monospace';
  durationDiv.style.minWidth = '50px';
  durationDiv.textContent = formatDuration(duration);

  voiceContainer.appendChild(playBtn);
  voiceContainer.appendChild(durationDiv);

  // Hidden audio element for playback
  const audio = document.createElement('audio');
  audio.src = src;
  audio.style.display = 'none';

  playBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (audio.paused) {
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
      await audio.play().catch(err => {
        console.error('Playback error:', err);
        toast('Failed to play audio');
      });
      
      audio.addEventListener('ended', () => {
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
      }, { once: true });
    } else {
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      audio.pause();
    }
  });

  // Metadata
  const meta = document.createElement('div');
  meta.className = 'lcg-msg-meta';
  let metaHTML = senderLabel
    ? `<span>${escapeHtml(senderLabel)}</span><span>·</span><span>${fmtTime(ts)}</span>`
    : `<span>${fmtTime(ts)}</span>`;
  
  if (me && uid) {
    const statusIcon = getStatusIcon(status);
    metaHTML += `<span class="msg-status" data-uid="${uid}" title="${status}">${statusIcon}</span>`;
  }
  
  meta.innerHTML = metaHTML;

  if (me && uid) {
    msgStatus.set(uid, { status, element: meta.querySelector('[data-uid]') });
  }

  box.appendChild(voiceContainer);
  box.appendChild(audio);
  box.appendChild(meta);
  
  if (uid) {
    box.style.cursor = 'context-menu';
    box.addEventListener('contextmenu', (e) => openContextMenu(e, box, uid));
    let longPressTimer;
    box.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        openContextMenu(new MouseEvent('contextmenu', { bubbles: true }), box, uid);
      }, 500);
    });
    box.addEventListener('touchend', () => clearTimeout(longPressTimer));
  }
  
  $('chat').appendChild(box);
  scrollChat();
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;
}

// Initialize voice recording on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupVoiceRecording);
} else {
  setupVoiceRecording();
}
