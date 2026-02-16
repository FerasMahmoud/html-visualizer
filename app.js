/**
 * HTML Visualizer - Application Logic
 * A single-page app for previewing, saving, and organizing HTML snippets
 */

// ========================================
// State Management
// ========================================
const state = {
    snippets: [],
    currentSnippetId: null,
    isModified: false,
    fileHandle: null, // For File System Access API
    editorContent: ''
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    // Editor
    editor: document.getElementById('htmlEditor'),
    lineNumbers: document.getElementById('lineNumbers'),
    previewFrame: document.getElementById('previewFrame'),
    currentTitle: document.getElementById('currentTitle'),

    // Stats
    lineCount: document.getElementById('lineCount'),
    charCount: document.getElementById('charCount'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusText: document.querySelector('.status-text'),

    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    snippetsList: document.getElementById('snippetsList'),
    snippetsCount: document.getElementById('snippetsCount'),

    // Buttons
    newSnippetBtn: document.getElementById('newSnippetBtn'),
    saveBtn: document.getElementById('saveBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    copyBtn: document.getElementById('copyBtn'),
    formatBtn: document.getElementById('formatBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    saveFolderBtn: document.getElementById('saveFolderBtn'),
    refreshPreview: document.getElementById('refreshPreview'),
    openPreview: document.getElementById('openPreview'),

    // Modal
    saveModal: document.getElementById('saveModal'),
    saveForm: document.getElementById('saveForm'),
    closeSaveModal: document.getElementById('closeSaveModal'),
    cancelSave: document.getElementById('cancelSave'),
    snippetTitle: document.getElementById('snippetTitle'),
    snippetDescription: document.getElementById('snippetDescription'),
    snippetCategory: document.getElementById('snippetCategory'),
    snippetTags: document.getElementById('snippetTags'),

    // Other
    resizer: document.getElementById('resizer'),
    toastContainer: document.getElementById('toastContainer')
};

// ========================================
// Initialize Application
// ========================================
function init() {
    loadSnippets();
    setupEventListeners();
    updateLineNumbers();
    updatePreview();
    renderSnippetsList();
    setStatus('Ready');
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Editor events
    elements.editor.addEventListener('input', handleEditorInput);
    elements.editor.addEventListener('scroll', syncScroll);
    elements.editor.addEventListener('keydown', handleEditorKeydown);
    elements.editor.addEventListener('paste', handlePaste);

    // Sidebar events
    elements.sidebarToggle.addEventListener('click', toggleSidebar);
    elements.searchInput.addEventListener('input', filterSnippets);
    elements.categoryFilter.addEventListener('change', filterSnippets);

    // Action buttons
    elements.newSnippetBtn.addEventListener('click', newSnippet);
    elements.saveBtn.addEventListener('click', openSaveModal);
    elements.exportBtn.addEventListener('click', exportSnippets);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importSnippets);
    elements.copyBtn.addEventListener('click', copyToClipboard);
    elements.formatBtn.addEventListener('click', formatHTML);
    elements.downloadBtn.addEventListener('click', downloadHTML);
    elements.saveFolderBtn.addEventListener('click', saveToFolder);
    elements.refreshPreview.addEventListener('click', updatePreview);
    elements.openPreview.addEventListener('click', openPreviewInNewTab);

    // Modal events
    elements.closeSaveModal.addEventListener('click', closeSaveModal);
    elements.cancelSave.addEventListener('click', closeSaveModal);
    elements.saveForm.addEventListener('submit', handleSaveSnippet);
    elements.saveModal.addEventListener('click', (e) => {
        if (e.target === elements.saveModal) closeSaveModal();
    });

    // Resizer
    setupResizer();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Title change
    elements.currentTitle.addEventListener('input', () => {
        state.isModified = true;
        updateStatus();
    });
}

// ========================================
// Editor Functions
// ========================================
function handleEditorInput() {
    state.editorContent = elements.editor.value;
    state.isModified = true;
    updateLineNumbers();
    updatePreview();
    updateStats();
    updateStatus();
}

function handleEditorKeydown(e) {
    // Tab key handling
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = elements.editor.selectionStart;
        const end = elements.editor.selectionEnd;
        const value = elements.editor.value;

        elements.editor.value = value.substring(0, start) + '  ' + value.substring(end);
        elements.editor.selectionStart = elements.editor.selectionEnd = start + 2;
        handleEditorInput();
    }

    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        openSaveModal();
    }

    // Ctrl/Cmd + Enter to update preview
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        updatePreview();
    }
}

function handlePaste(e) {
    // Allow paste and update after
    setTimeout(() => {
        handleEditorInput();
        showToast('HTML pasted successfully', 'success');
    }, 0);
}

function updateLineNumbers() {
    const lines = elements.editor.value.split('\n').length;
    const lineNumbersHtml = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('');
    elements.lineNumbers.innerHTML = lineNumbersHtml;
}

function updateStats() {
    const content = elements.editor.value;
    const lines = content.split('\n').length;
    const chars = content.length;

    elements.lineCount.textContent = `${lines} lines`;
    elements.charCount.textContent = `${chars.toLocaleString()} chars`;
}

function syncScroll() {
    elements.lineNumbers.scrollTop = elements.editor.scrollTop;
}

// ========================================
// Preview Functions
// ========================================
function updatePreview() {
    const html = elements.editor.value;

    // Create a safe preview with base styles
    const previewHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; font-family: system-ui, sans-serif; }
            </style>
        </head>
        <body>
            ${html}
        </body>
        </html>
    `;

    const blob = new Blob([previewHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Revoke previous URL to prevent memory leaks
    if (elements.previewFrame.dataset.blobUrl) {
        URL.revokeObjectURL(elements.previewFrame.dataset.blobUrl);
    }

    elements.previewFrame.src = url;
    elements.previewFrame.dataset.blobUrl = url;

    setStatus('Preview updated');
}

function openPreviewInNewTab() {
    const html = elements.editor.value;
    const previewHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${elements.currentTitle.value || 'Preview'}</title>
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; font-family: system-ui, sans-serif; }
            </style>
        </head>
        <body>
            ${html}
        </body>
        </html>
    `;

    const blob = new Blob([previewHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
}

// ========================================
// Snippet Management (localStorage)
// ========================================
function loadSnippets() {
    try {
        const stored = localStorage.getItem('htmlSnippets');
        state.snippets = stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading snippets:', e);
        state.snippets = [];
    }
}

function saveSnippetsToStorage() {
    try {
        localStorage.setItem('htmlSnippets', JSON.stringify(state.snippets));
    } catch (e) {
        console.error('Error saving snippets:', e);
        showToast('Failed to save to localStorage', 'error');
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ========================================
// Modal Functions
// ========================================
function openSaveModal() {
    // Pre-fill with current title if editing
    if (state.currentSnippetId) {
        const snippet = state.snippets.find(s => s.id === state.currentSnippetId);
        if (snippet) {
            elements.snippetTitle.value = snippet.title;
            elements.snippetDescription.value = snippet.description || '';
            elements.snippetCategory.value = snippet.category || 'other';
            elements.snippetTags.value = (snippet.tags || []).join(', ');
        }
    } else {
        elements.snippetTitle.value = elements.currentTitle.value || '';
        elements.snippetDescription.value = '';
        elements.snippetCategory.value = 'other';
        elements.snippetTags.value = '';
    }

    elements.saveModal.classList.add('active');
    elements.snippetTitle.focus();
}

function closeSaveModal() {
    elements.saveModal.classList.remove('active');
    elements.saveForm.reset();
}

function handleSaveSnippet(e) {
    e.preventDefault();

    const title = elements.snippetTitle.value.trim() || 'Untitled';
    const description = elements.snippetDescription.value.trim();
    const category = elements.snippetCategory.value;
    const tagsInput = elements.snippetTags.value;
    const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t);

    const snippetData = {
        title,
        description,
        category,
        tags,
        html: elements.editor.value,
        updatedAt: new Date().toISOString()
    };

    if (state.currentSnippetId) {
        // Update existing snippet
        const index = state.snippets.findIndex(s => s.id === state.currentSnippetId);
        if (index !== -1) {
            snippetData.id = state.currentSnippetId;
            snippetData.createdAt = state.snippets[index].createdAt;
            state.snippets[index] = snippetData;
        }
    } else {
        // Create new snippet
        snippetData.id = generateId();
        snippetData.createdAt = new Date().toISOString();
        state.snippets.unshift(snippetData);
        state.currentSnippetId = snippetData.id;
    }

    saveSnippetsToStorage();
    renderSnippetsList();
    elements.currentTitle.value = title;
    state.isModified = false;
    updateStatus();
    closeSaveModal();
    showToast('Snippet saved successfully', 'success');
}

// ========================================
// Render Snippets List
// ========================================
function renderSnippetsList() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const categoryFilter = elements.categoryFilter.value;

    let filtered = state.snippets;

    // Apply search filter
    if (searchTerm) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(searchTerm) ||
            (s.description || '').toLowerCase().includes(searchTerm) ||
            (s.tags || []).some(t => t.includes(searchTerm))
        );
    }

    // Apply category filter
    if (categoryFilter) {
        filtered = filtered.filter(s => s.category === categoryFilter);
    }

    // Update count
    elements.snippetsCount.textContent = `${filtered.length} snippet${filtered.length !== 1 ? 's' : ''}`;

    // Render list
    if (filtered.length === 0) {
        elements.snippetsList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>${searchTerm || categoryFilter ? 'No matching snippets' : 'No snippets yet'}</p>
                <span>${searchTerm || categoryFilter ? 'Try different search terms' : 'Paste HTML and save to get started'}</span>
            </div>
        `;
        return;
    }

    elements.snippetsList.innerHTML = filtered.map(snippet => `
        <div class="snippet-card ${snippet.id === state.currentSnippetId ? 'active' : ''}"
             data-id="${snippet.id}">
            <div class="snippet-card-actions">
                <button class="btn-icon btn-delete" title="Delete" data-action="delete" data-id="${snippet.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
            <div class="snippet-card-title">
                ${escapeHtml(snippet.title)}
            </div>
            ${snippet.description ? `<div class="snippet-card-description">${escapeHtml(snippet.description)}</div>` : ''}
            <div class="snippet-card-meta">
                <span class="snippet-card-category">${snippet.category || 'other'}</span>
                <span class="snippet-card-date">${formatDate(snippet.updatedAt)}</span>
            </div>
            ${snippet.tags && snippet.tags.length > 0 ? `
                <div class="snippet-card-tags">
                    ${snippet.tags.slice(0, 3).map(tag => `<span class="snippet-tag">${escapeHtml(tag)}</span>`).join('')}
                    ${snippet.tags.length > 3 ? `<span class="snippet-tag">+${snippet.tags.length - 3}</span>` : ''}
                </div>
            ` : ''}
        </div>
    `).join('');

    // Add click listeners to snippet cards
    elements.snippetsList.querySelectorAll('.snippet-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="delete"]')) {
                deleteSnippet(e.target.closest('[data-action="delete"]').dataset.id);
            } else {
                loadSnippet(card.dataset.id);
            }
        });
    });
}

function loadSnippet(id) {
    const snippet = state.snippets.find(s => s.id === id);
    if (!snippet) return;

    state.currentSnippetId = id;
    state.editorContent = snippet.html;
    elements.editor.value = snippet.html;
    elements.currentTitle.value = snippet.title;
    state.isModified = false;

    updateLineNumbers();
    updatePreview();
    updateStats();
    updateStatus();
    renderSnippetsList();
    setStatus(`Loaded: ${snippet.title}`);
}

function deleteSnippet(id) {
    if (!confirm('Delete this snippet?')) return;

    state.snippets = state.snippets.filter(s => s.id !== id);

    // If deleted current snippet, clear editor
    if (state.currentSnippetId === id) {
        state.currentSnippetId = null;
        elements.editor.value = '';
        elements.currentTitle.value = 'Untitled Snippet';
        updateLineNumbers();
        updatePreview();
    }

    saveSnippetsToStorage();
    renderSnippetsList();
    showToast('Snippet deleted', 'success');
}

function filterSnippets() {
    renderSnippetsList();
}

function newSnippet() {
    state.currentSnippetId = null;
    state.editorContent = '';
    elements.editor.value = '';
    elements.currentTitle.value = 'Untitled Snippet';
    state.isModified = false;

    updateLineNumbers();
    updatePreview();
    updateStats();
    updateStatus();
    renderSnippetsList();
    setStatus('New snippet');
}

// ========================================
// Import/Export Functions
// ========================================
function exportSnippets() {
    if (state.snippets.length === 0) {
        showToast('No snippets to export', 'warning');
        return;
    }

    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        snippets: state.snippets
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `html-snippets-${formatDateForFile(new Date())}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast(`Exported ${state.snippets.length} snippets`, 'success');
}

function importSnippets(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!data.snippets || !Array.isArray(data.snippets)) {
                throw new Error('Invalid file format');
            }

            // Add imported snippets
            const importedCount = data.snippets.length;
            data.snippets.forEach(snippet => {
                snippet.id = generateId(); // Generate new IDs to avoid conflicts
                snippet.importedAt = new Date().toISOString();
            });

            state.snippets = [...data.snippets, ...state.snippets];
            saveSnippetsToStorage();
            renderSnippetsList();

            showToast(`Imported ${importedCount} snippets`, 'success');
        } catch (err) {
            console.error('Import error:', err);
            showToast('Failed to import: Invalid file format', 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
}

// ========================================
// File System Access API (Local Folder Save)
// ========================================
async function saveToFolder() {
    const html = elements.editor.value;
    const title = elements.currentTitle.value || 'snippet';

    // Check if File System Access API is supported
    if (!('showSaveFilePicker' in window)) {
        // Fallback to download
        downloadHTML();
        return;
    }

    try {
        // Generate filename from title
        const filename = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') + '.html';

        const options = {
            suggestedName: filename,
            types: [{
                description: 'HTML Files',
                accept: { 'text/html': ['.html'] }
            }]
        };

        // Show save file picker
        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();

        // Write the HTML content
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
</head>
<body>
${html}
</body>
</html>`;

        await writable.write(fullHTML);
        await writable.close();

        // Store handle for future saves
        state.fileHandle = handle;

        showToast(`Saved to: ${handle.name}`, 'success');
        setStatus('Saved to local file');
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Save error:', err);
            showToast('Failed to save file', 'error');
        }
    }
}

// ========================================
// Utility Functions
// ========================================
function copyToClipboard() {
    const html = elements.editor.value;
    if (!html) {
        showToast('Nothing to copy', 'warning');
        return;
    }

    navigator.clipboard.writeText(html)
        .then(() => showToast('Copied to clipboard', 'success'))
        .catch(() => showToast('Failed to copy', 'error'));
}

function downloadHTML() {
    const html = elements.editor.value;
    const title = elements.currentTitle.value || 'snippet';
    const filename = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '.html';

    const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
</head>
<body>
${html}
</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    showToast(`Downloaded: ${filename}`, 'success');
}

function formatHTML() {
    let html = elements.editor.value;

    // Simple HTML formatting (basic indentation)
    // For production, consider using a proper formatter like prettier
    try {
        html = html
            // Add newlines after >
            .replace(/>/g, '>\n')
            // Add newlines before <
            .replace(/</g, '\n<')
            // Remove multiple newlines
            .replace(/\n\s*\n/g, '\n')
            // Trim
            .trim();

        // Apply indentation
        const lines = html.split('\n');
        let indent = 0;
        const formatted = lines.map(line => {
            line = line.trim();
            if (!line) return '';

            // Decrease indent for closing tags
            if (line.match(/^<\/\w/)) {
                indent = Math.max(0, indent - 1);
            }

            const result = '  '.repeat(indent) + line;

            // Increase indent after opening tags (except self-closing)
            if (line.match(/^<\w[^>]*[^\/]>$/)) {
                indent++;
            }

            return result;
        });

        elements.editor.value = formatted.join('\n');
        handleEditorInput();
        showToast('HTML formatted', 'success');
    } catch (err) {
        console.error('Format error:', err);
        showToast('Failed to format HTML', 'error');
    }
}

function toggleSidebar() {
    elements.sidebar.classList.toggle('collapsed');
}

function setupResizer() {
    let isResizing = false;
    const editorPanel = document.querySelector('.editor-panel');
    const previewPanel = document.querySelector('.preview-panel');

    elements.resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        elements.resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const container = document.querySelector('.editor-container');
        const containerRect = container.getBoundingClientRect();
        const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Limit between 20% and 80%
        const clampedPercentage = Math.max(20, Math.min(80, percentage));

        editorPanel.style.flex = `0 0 ${clampedPercentage}%`;
        previewPanel.style.flex = `0 0 ${100 - clampedPercentage}%`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            elements.resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

function handleGlobalKeydown(e) {
    // Ctrl/Cmd + B to toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
    }

    // Escape to close modal
    if (e.key === 'Escape' && elements.saveModal.classList.contains('active')) {
        closeSaveModal();
    }
}

// ========================================
// Status & Toast Functions
// ========================================
function setStatus(text) {
    elements.statusText.textContent = text;
    setTimeout(() => {
        if (elements.statusText.textContent === text) {
            elements.statusText.textContent = 'Ready';
        }
    }, 3000);
}

function updateStatus() {
    if (state.isModified) {
        elements.statusIndicator.classList.add('modified');
        elements.statusText.textContent = 'Modified';
    } else {
        elements.statusIndicator.classList.remove('modified');
        elements.statusText.textContent = 'Saved';
    }
}

function showToast(message, type = 'info') {
    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// Helper Functions
// ========================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return 'just now';

    // Less than 1 hour
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;

    // Less than 24 hours
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    // Less than 7 days
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    // Otherwise show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateForFile(date) {
    return date.toISOString().split('T')[0];
}

// ========================================
// Start Application
// ========================================
document.addEventListener('DOMContentLoaded', init);
