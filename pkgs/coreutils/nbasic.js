// Basic nano-inspired text editor
// fas fa-edit
// args: fullscreen
function nbasic(context) {
    const { args = [], stdout, processor } = context;
    
    // Help option
    if (args.includes('-h') || args.includes('--help')) {
        stdout('Usage: nbasic [FILE]');
        stdout('Basic text editor inspired by nano.');
        stdout('');
        stdout('  FILE              file to edit (will be created if it does not exist)');
        stdout('  -h, --help        display this help and exit');
        stdout('');
        stdout('Editor Controls:');
        stdout('  Ctrl+S            Save file');
        stdout('  Ctrl+X            Exit editor');
        stdout('  Ctrl+O            Write out (save as)');
        return;
    }
    
    let filename = args.find(arg => !arg.startsWith('-'));
    if (!filename) {
        stdout('nbasic: missing filename', 'error');
        stdout("Try 'nbasic --help' for more information.", 'error');
        return;
    }
    
    let resolvedPath = processor.resolvePath(filename);
    let content = '';
    let isNewFile = false;
    
    // Load existing file or create new
    if (processor.pathExists(resolvedPath)) {
        const entry = processor.fileSystem.get(resolvedPath);
        if (entry.type === 'directory') {
            stdout(`nbasic: ${filename}: Is a directory`, 'error');
            return;
        }
        content = entry.content || '';
    } else {
        isNewFile = true;
    }
    
    // Create editor interface
    const terminalOutput = document.getElementById('terminal-output');
    const editorDiv = document.createElement('div');
    editorDiv.className = 'nbasic-editor';
    editorDiv.innerHTML = `
        <div class="editor-header">
          <div class="editor-title">Wafflent nbasic - ${filename} ${isNewFile ? '[New File]' : ''}</div>
          <div class="editor-controls">
            <span class="editor-info">^S Save  ^X Exit  ^O Write Out</span>
            <button class="editor-close-btn" title="Save and Exit">×</button>
          </div>
        </div>
        <textarea class="editor-content" spellcheck="false">${content}</textarea>
        <div class="editor-status">
          <span class="editor-cursor">Line 1, Col 1</span>
          <span class="editor-modified"></span>
        </div>
    `;
    
    // Add editor styles
    const style = document.createElement('style');
    style.textContent = `
        .nbasic-editor {
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-dark);
            border: 1px solid var(--yellow);
            display: flex;
            flex-direction: column;
            z-index: 1000;
        }
        .editor-header {
            background: var(--bg-light);
            padding: 0.5rem;
            border-bottom: 1px solid var(--yellow);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .editor-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .editor-close-btn {
            background: var(--red);
            color: white;
            border: none;
            border-radius: 3px;
            width: 24px;
            height: 24px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        }
        .editor-close-btn:hover {
            background: var(--red-bright);
        }
        .editor-title {
            color: var(--yellow-bright);
            font-weight: bold;
        }
        .editor-info {
            color: var(--fg-dim);
            font-size: 0.9em;
        }
        .editor-content {
            flex: 1;
            background: var(--bg-dark);
            color: var(--fg-main);
            border: none;
            outline: none;
            padding: 1rem;
            font-family: 'Courier New', 'Monaco', monospace;
            font-size: 14px;
            line-height: 1.4;
            resize: none;
            white-space: pre;
            overflow-wrap: normal;
        }
        .editor-status {
            background: var(--bg-light);
            padding: 0.25rem 0.5rem;
            border-top: 1px solid var(--fg-dim);
            display: flex;
            justify-content: space-between;
            color: var(--fg-dim);
            font-size: 0.85em;
        }
        .editor-modified {
            color: var(--yellow-bright);
        }
    `;
    document.head.appendChild(style);
    
    terminalOutput.appendChild(editorDiv);
    
    const textarea = editorDiv.querySelector('.editor-content');
    const statusCursor = editorDiv.querySelector('.editor-cursor');
    const statusModified = editorDiv.querySelector('.editor-modified');
    const closeBtn = editorDiv.querySelector('.editor-close-btn');
    let isModified = false;
    
    // Focus textarea
    textarea.focus();
    
    // Close button click handler - Save and Exit
    closeBtn.addEventListener('click', () => {
        if (isModified) {
            saveFile(); // Always save if modified when clicking X
        }
        exitEditor();
    });
    
    // Update cursor position
    function updateCursor() {
        const pos = textarea.selectionStart;
        const text = textarea.value.substring(0, pos);
        const lines = text.split('\n');
        const line = lines.length;
        const col = lines[lines.length - 1].length + 1;
        statusCursor.textContent = `Line ${line}, Col ${col}`;
    }
    
    // Update modified status
    function setModified(modified) {
        isModified = modified;
        statusModified.textContent = modified ? '[Modified]' : '';
    }
    
    // Event listeners
    textarea.addEventListener('input', () => {
        if (!isModified) setModified(true);
        updateCursor();
    });
    
    textarea.addEventListener('keyup', updateCursor);
    textarea.addEventListener('click', updateCursor);
    
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    saveFile();
                    break;
                case 'x':
                    e.preventDefault();
                    exitEditor();
                    break;
                case 'o':
                    e.preventDefault();
                    saveAsFile();
                    break;
            }
        }
    });
    
    function saveFile() {
        const content = textarea.value;
        
        // Create or update file
        processor.fileSystem.set(resolvedPath, {
            type: 'file',
            content: content,
            created: isNewFile ? new Date().toISOString() : (processor.fileSystem.get(resolvedPath)?.created || new Date().toISOString()),
            modified: new Date().toISOString()
        });
        
        // Add to parent directory if new file
        if (isNewFile) {
            const parentPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) || '/';
            const parentEntry = processor.fileSystem.get(parentPath);
            if (parentEntry && parentEntry.type === 'directory') {
                const basename = resolvedPath.substring(resolvedPath.lastIndexOf('/') + 1);
                if (!parentEntry.content.includes(basename)) {
                    parentEntry.content.push(basename);
                }
            }
            isNewFile = false;
        }
        
        processor.saveFileSystem();
        setModified(false);
        
        // Show save confirmation briefly
        const originalText = statusModified.textContent;
        statusModified.textContent = '[Saved]';
        statusModified.style.color = 'var(--green-bright)';
        setTimeout(() => {
            statusModified.textContent = originalText;
            statusModified.style.color = 'var(--yellow-bright)';
        }, 1500);
    }
    
    function saveAsFile() {
        const newFilename = prompt('File Name to Write:', filename);
        if (newFilename && newFilename !== filename) {
            const newResolvedPath = processor.resolvePath(newFilename);
            resolvedPath = newResolvedPath;
            filename = newFilename;
            editorDiv.querySelector('.editor-title').textContent = `Wafflent nbasic - ${filename}`;
            isNewFile = !processor.pathExists(resolvedPath);
            saveFile();
        }
    }
    
    function exitEditor() {
        if (isModified) {
            const save = confirm('Save modified buffer? (Answering "No" will DISCARD changes!)');
            if (save) {
                saveFile();
            }
        }
        
        // Remove editor
        editorDiv.remove();
        document.head.removeChild(style);
        
        // Show new prompt
        const showPrompt = window.showPrompt;
        if (showPrompt) showPrompt();
    }
    
    // Initial cursor update
    updateCursor();
}