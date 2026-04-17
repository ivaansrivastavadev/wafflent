/* ═══════════════════════════════════════════════════════════════
   CUSTOM MEDIA PLAYER
   ═══════════════════════════════════════════════════════════════ */

/* ─── Create custom audio player ─── */
function createMediaPlayer({ src, type = 'audio', fileName = 'media', onDownload = null }) {
  const container = document.createElement('div');
  container.className = 'lcg-media-player';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '10px';
  container.style.padding = '12px';
  container.style.borderRadius = 'var(--r-md)';
  container.style.background = 'rgba(255, 255, 255, 0.08)';
  container.style.backdropFilter = 'blur(4px)';
  container.style.minWidth = '280px';
  container.style.maxWidth = '100%';

  const audio = document.createElement('audio');
  audio.src = src;
  audio.style.display = 'none';

  // Controls container
  const controlsContainer = document.createElement('div');
  controlsContainer.style.display = 'flex';
  controlsContainer.style.alignItems = 'center';
  controlsContainer.style.gap = '8px';
  controlsContainer.style.justifyContent = 'space-between';

  // Left controls (play, rewind, forward)
  const leftControls = document.createElement('div');
  leftControls.style.display = 'flex';
  leftControls.style.alignItems = 'center';
  leftControls.style.gap = '4px';

  // Play/Pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'lcg-media-btn';
  playBtn.innerHTML = '<i class="fas fa-play"></i>';
  playBtn.style.width = '40px';
  playBtn.style.height = '40px';
  playBtn.style.borderRadius = '50%';
  playBtn.style.border = 'none';
  playBtn.style.background = 'var(--accent)';
  playBtn.style.color = 'white';
  playBtn.style.cursor = 'pointer';
  playBtn.style.fontSize = '14px';
  playBtn.style.display = 'flex';
  playBtn.style.alignItems = 'center';
  playBtn.style.justifyContent = 'center';
  playBtn.style.transition = 'all 120ms ease';
  playBtn.style.flexShrink = '0';

  playBtn.addEventListener('mouseover', () => {
    playBtn.style.transform = 'scale(1.08)';
  });
  playBtn.addEventListener('mouseout', () => {
    playBtn.style.transform = 'scale(1)';
  });
  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play();
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      audio.pause();
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
  });

  audio.addEventListener('ended', () => {
    playBtn.innerHTML = '<i class="fas fa-play"></i>';
  });

  // Rewind 5s button
  const rewindBtn = document.createElement('button');
  rewindBtn.className = 'lcg-media-btn sm';
  rewindBtn.innerHTML = '<i class="fas fa-rotate-left"></i> 5s';
  rewindBtn.style.padding = '6px 10px';
  rewindBtn.style.fontSize = '11px';
  rewindBtn.style.borderRadius = 'var(--r-sm)';
  rewindBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  rewindBtn.style.background = 'transparent';
  rewindBtn.style.color = 'inherit';
  rewindBtn.style.cursor = 'pointer';
  rewindBtn.style.transition = 'all 120ms ease';
  rewindBtn.style.display = 'flex';
  rewindBtn.style.alignItems = 'center';
  rewindBtn.style.gap = '4px';

  rewindBtn.addEventListener('mouseover', () => {
    rewindBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  rewindBtn.addEventListener('mouseout', () => {
    rewindBtn.style.background = 'transparent';
  });
  rewindBtn.addEventListener('click', () => {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  // Forward 5s button
  const forwardBtn = document.createElement('button');
  forwardBtn.className = 'lcg-media-btn sm';
  forwardBtn.innerHTML = '5s <i class="fas fa-rotate-right"></i>';
  forwardBtn.style.padding = '6px 10px';
  forwardBtn.style.fontSize = '11px';
  forwardBtn.style.borderRadius = 'var(--r-sm)';
  forwardBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  forwardBtn.style.background = 'transparent';
  forwardBtn.style.color = 'inherit';
  forwardBtn.style.cursor = 'pointer';
  forwardBtn.style.transition = 'all 120ms ease';
  forwardBtn.style.display = 'flex';
  forwardBtn.style.alignItems = 'center';
  forwardBtn.style.gap = '4px';

  forwardBtn.addEventListener('mouseover', () => {
    forwardBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  forwardBtn.addEventListener('mouseout', () => {
    forwardBtn.style.background = 'transparent';
  });
  forwardBtn.addEventListener('click', () => {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  });

  leftControls.appendChild(playBtn);
  leftControls.appendChild(rewindBtn);
  leftControls.appendChild(forwardBtn);

  // Time display
  const timeDisplay = document.createElement('div');
  timeDisplay.style.fontSize = '12px';
  timeDisplay.style.fontFamily = 'monospace';
  timeDisplay.style.minWidth = '80px';
  timeDisplay.style.textAlign = 'center';
  timeDisplay.style.fontWeight = '500';
  timeDisplay.textContent = '0:00 / 0:00';

  audio.addEventListener('loadedmetadata', () => {
    updateTimeDisplay();
  });
  audio.addEventListener('timeupdate', () => {
    updateTimeDisplay();
  });

  function updateTimeDisplay() {
    const current = formatTime(audio.currentTime);
    const duration = formatTime(audio.duration);
    timeDisplay.textContent = `${current} / ${duration}`;
  }

  // Right controls (mute, download)
  const rightControls = document.createElement('div');
  rightControls.style.display = 'flex';
  rightControls.style.alignItems = 'center';
  rightControls.style.gap = '4px';

  // Mute button
  const muteBtn = document.createElement('button');
  muteBtn.className = 'lcg-media-btn sm';
  muteBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
  muteBtn.style.padding = '6px 8px';
  muteBtn.style.fontSize = '12px';
  muteBtn.style.borderRadius = 'var(--r-sm)';
  muteBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  muteBtn.style.background = 'transparent';
  muteBtn.style.color = 'inherit';
  muteBtn.style.cursor = 'pointer';
  muteBtn.style.transition = 'all 120ms ease';
  muteBtn.style.display = 'flex';
  muteBtn.style.alignItems = 'center';

  muteBtn.addEventListener('click', () => {
    if (audio.muted) {
      audio.muted = false;
      muteBtn.innerHTML = '<i class="fas fa-volume-high"></i>';
    } else {
      audio.muted = true;
      muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
    }
  });

  muteBtn.addEventListener('mouseover', () => {
    muteBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  muteBtn.addEventListener('mouseout', () => {
    muteBtn.style.background = 'transparent';
  });

  // Download button
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'lcg-media-btn sm';
  downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
  downloadBtn.style.padding = '6px 8px';
  downloadBtn.style.fontSize = '12px';
  downloadBtn.style.borderRadius = 'var(--r-sm)';
  downloadBtn.style.border = '1px solid rgba(255,255,255,0.2)';
  downloadBtn.style.background = 'transparent';
  downloadBtn.style.color = 'inherit';
  downloadBtn.style.cursor = 'pointer';
  downloadBtn.style.transition = 'all 120ms ease';
  downloadBtn.style.display = 'flex';
  downloadBtn.style.alignItems = 'center';

  downloadBtn.addEventListener('click', () => {
    if (onDownload) {
      onDownload();
    } else {
      downloadMedia(src, fileName);
    }
  });

  downloadBtn.addEventListener('mouseover', () => {
    downloadBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  downloadBtn.addEventListener('mouseout', () => {
    downloadBtn.style.background = 'transparent';
  });

  rightControls.appendChild(muteBtn);
  rightControls.appendChild(downloadBtn);

  // Progress slider
  const sliderContainer = document.createElement('div');
  sliderContainer.style.display = 'flex';
  sliderContainer.style.alignItems = 'center';
  sliderContainer.style.gap = '8px';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '0';
  slider.className = 'lcg-media-slider';
  slider.style.flex = '1';
  slider.style.height = '4px';
  slider.style.borderRadius = '2px';
  slider.style.cursor = 'pointer';
  slider.style.background = 'rgba(255,255,255,0.2)';

  audio.addEventListener('timeupdate', () => {
    if (!slider.dataset.seeking) {
      slider.value = (audio.currentTime / audio.duration) * 100 || 0;
    }
  });

  slider.addEventListener('input', () => {
    slider.dataset.seeking = true;
  });

  slider.addEventListener('change', () => {
    audio.currentTime = (slider.value / 100) * audio.duration;
    slider.dataset.seeking = false;
  });

  sliderContainer.appendChild(leftControls);
  sliderContainer.appendChild(timeDisplay);
  sliderContainer.appendChild(rightControls);

  // Assemble container
  controlsContainer.appendChild(sliderContainer);
  container.appendChild(slider);
  container.appendChild(controlsContainer);
  container.appendChild(audio);

  return container;
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function downloadMedia(src, fileName) {
  const link = document.createElement('a');
  link.href = src;
  link.download = fileName || 'media';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
