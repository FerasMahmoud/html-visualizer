/**
 * HTML Visualizer - Application Logic
 * Auto-save, mobile-friendly, one-click preview
 */

// ========================================
// State Management
// ========================================
const state = {
    snippets: [],
    currentSnippetId: null,
    fileHandle: null,
    autoSaveTimeout: null,
    mobileView: 'split'
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
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    snippetsList: document.getElementById('snippetsList'),
    snippetsCount: document.getElementById('snippetsCount'),

    // Mobile
    mobileHeader: document.getElementById('mobileHeader'),
    menuBtn: document.getElementById('menuBtn'),
    sidebarClose: document.getElementById('sidebarClose'),
    mobileTitleText: document.getElementById('mobileTitleText'),
    mobilePreviewBtn: document.getElementById('mobilePreviewBtn'),
    mobileViewToggle: document.getElementById('mobileViewToggle'),
    editorPanel: document.getElementById('editorPanel'),
    previewPanel: document.getElementById('previewPanel'),
    editorContainer: document.getElementById('editorContainer'),

    // Buttons
    openNewTabBtn: document.getElementById('openNewTabBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    downloadBtn: document.getElementById('downloadBtn'),
    saveFolderBtn: document.getElementById('saveFolderBtn'),
    refreshPreview: document.getElementById('refreshPreview'),

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

    // Check mobile and set initial view
    if (window.innerWidth <= 768) {
        setMobileView('editor');
    }
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
    elements.menuBtn.addEventListener('click', openSidebar);
    elements.sidebarClose.addEventListener('click', closeSidebar);
    elements.sidebarOverlay.addEventListener('click', closeSidebar);
    elements.searchInput.addEventListener('input', filterSnippets);
    elements.categoryFilter.addEventListener('change', filterSnippets);

    // Action buttons
    elements.openNewTabBtn.addEventListener('click', openInNewTab);
    elements.exportBtn.addEventListener('click', exportSnippets);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importSnippets);
    elements.downloadBtn.addEventListener('click', downloadHTML);
    elements.saveFolderBtn.addEventListener('click', saveToFolder);
    elements.refreshPreview.addEventListener('click', updatePreview);
    elements.mobilePreviewBtn.addEventListener('click', openInNewTab);

    // Mobile view toggle
    elements.mobileViewToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.toggle-btn');
        if (btn) {
            setMobileView(btn.dataset.view);
        }
    });

    // Resizer
    setupResizer();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Handle visibility change - save when leaving
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && elements.editor.value.trim()) {
            autoSave();
        }
    });

    // Save before unload
    window.addEventListener('beforeunload', () => {
        if (elements.editor.value.trim()) {
            autoSave();
        }
    });
}

// ========================================
// Mobile View
// ========================================
function setMobileView(view) {
    state.mobileView = view;

    // Update toggle buttons
    elements.mobileViewToggle.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Show/hide panels
    if (view === 'editor') {
        elements.editorPanel.classList.remove('hidden');
        elements.previewPanel.classList.add('hidden');
    } else if (view === 'preview') {
        elements.editorPanel.classList.add('hidden');
        elements.previewPanel.classList.remove('hidden');
    } else {
        elements.editorPanel.classList.remove('hidden');
        elements.previewPanel.classList.remove('hidden');
    }
}

function openSidebar() {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('active');
}

// ========================================
// Editor Functions
// ========================================
function handleEditorInput() {
    updateLineNumbers();
    updatePreview();
    updateStats();

    // Extract title from HTML
    const title = extractTitle(elements.editor.value);
    updateTitle(title);

    // Auto-save with debounce
    scheduleAutoSave();
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
}

function handlePaste() {
    setTimeout(() => {
        handleEditorInput();
        showToast('Pasted & auto-saved', 'success');
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

    elements.lineCount.textContent = `${lines}`;
    elements.charCount.textContent = `${chars.toLocaleString()}`;
}

function syncScroll() {
    elements.lineNumbers.scrollTop = elements.editor.scrollTop;
}

// ========================================
// Title Extraction
// ========================================
function extractTitle(html) {
    if (!html || !html.trim()) return '';

    // Try to find <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch && titleMatch[1].trim()) {
        return titleMatch[1].trim();
    }

    // Try to find first heading
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && h1Match[1].trim()) {
        return h1Match[1].trim();
    }

    // Try to find id or class that suggests a component
    const idMatch = html.match(/id=["']([^"']+)["']/i);
    if (idMatch && idMatch[1].length < 30) {
        return toTitleCase(idMatch[1].replace(/[-_]/g, ' '));
    }

    // Default to first 30 chars of content
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    if (textContent) {
        const firstLine = textContent.split('\n')[0].trim();
        return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
    }

    return 'Untitled';
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

function updateTitle(title) {
    elements.currentTitle.value = title;
    elements.mobileTitleText.textContent = title || 'HTML Visualizer';
    document.title = title ? `${title} - HTML Visualizer` : 'HTML Visualizer';
}

// ========================================
// Auto-Save
// ========================================
function scheduleAutoSave() {
    // Clear existing timeout
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    // Show saving indicator
    elements.statusIndicator.classList.add('saving');
    elements.statusText.textContent = 'Saving...';

    // Save after 1 second of inactivity
    state.autoSaveTimeout = setTimeout(() => {
        autoSave();
    }, 1000);
}

function autoSave() {
    const html = elements.editor.value.trim();
    if (!html) return;

    const title = elements.currentTitle.value || 'Untitled';
    const category = detectCategory(html);

    // Check if this is an update to existing snippet or new
    let snippet;
    const now = new Date().toISOString();

    if (state.currentSnippetId) {
        // Update existing
        const index = state.snippets.findIndex(s => s.id === state.currentSnippetId);
        if (index !== -1) {
            snippet = state.snippets[index];
            snippet.title = title;
            snippet.html = html;
            snippet.category = category;
            snippet.updatedAt = now;
        }
    }

    if (!snippet) {
        // Create new
        snippet = {
            id: generateId(),
            title,
            html,
            category,
            createdAt: now,
            updatedAt: now
        };
        state.snippets.unshift(snippet);
        state.currentSnippetId = snippet.id;
    }

    saveSnippetsToStorage();
    renderSnippetsList();

    // Update status
    elements.statusIndicator.classList.remove('saving');
    elements.statusText.textContent = 'Saved';
    setStatus('Auto-saved');
}

function detectCategory(html) {
    const lowerHtml = html.toLowerCase();

    if (lowerHtml.includes('<form') || lowerHtml.includes('input') || lowerHtml.includes('button')) {
        return 'form';
    }
    if (lowerHtml.includes('@keyframes') || lowerHtml.includes('animation') || lowerHtml.includes('transition')) {
        return 'animation';
    }
    if (lowerHtml.includes('canvas') || lowerHtml.includes('game') || lowerHtml.includes('score')) {
        return 'game';
    }
    if (lowerHtml.includes('grid') || lowerHtml.includes('flex') || lowerHtml.includes('layout')) {
        return 'layout';
    }
    if (lowerHtml.includes('class=') && (lowerHtml.includes('card') || lowerHtml.includes('modal') || lowerHtml.includes('nav'))) {
        return 'component';
    }

    return 'other';
}

// ========================================
// Preview Functions
// ========================================
function updatePreview() {
    const html = elements.editor.value;

    const previewHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>* { box-sizing: border-box; } body { margin: 0; font-family: system-ui, sans-serif; }</style>
</head>
<body>${html}</body>
</html>`;

    const blob = new Blob([previewHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (elements.previewFrame.dataset.blobUrl) {
        URL.revokeObjectURL(elements.previewFrame.dataset.blobUrl);
    }

    elements.previewFrame.src = url;
    elements.previewFrame.dataset.blobUrl = url;
}

function openInNewTab() {
    const html = elements.editor.value;
    const title = elements.currentTitle.value || 'Preview';

    const fullHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>* { box-sizing: border-box; } body { margin: 0; font-family: system-ui, sans-serif; }</style>
</head>
<body>${html}</body>
</html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    showToast('Opened in new tab', 'success');
}

// ========================================
// Snippet Management
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
        showToast('Storage full - clear old snippets', 'error');
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ========================================
// Render Snippets List
// ========================================
function renderSnippetsList() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const categoryFilter = elements.categoryFilter.value;

    let filtered = state.snippets;

    if (searchTerm) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(searchTerm) ||
            (s.html || '').toLowerCase().includes(searchTerm)
        );
    }

    if (categoryFilter) {
        filtered = filtered.filter(s => s.category === categoryFilter);
    }

    elements.snippetsCount.textContent = `${filtered.length} snippet${filtered.length !== 1 ? 's' : ''}`;

    if (filtered.length === 0) {
        elements.snippetsList.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <p>${searchTerm || categoryFilter ? 'No matches' : 'No snippets yet'}</p>
                <span>${searchTerm || categoryFilter ? 'Try different search' : 'Paste HTML to auto-save'}</span>
            </div>
        `;
        return;
    }

    elements.snippetsList.innerHTML = filtered.map(snippet => `
        <div class="snippet-card ${snippet.id === state.currentSnippetId ? 'active' : ''}" data-id="${snippet.id}">
            <div class="snippet-card-actions">
                <button class="btn-icon btn-delete" title="Delete" data-action="delete" data-id="${snippet.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
            <div class="snippet-card-title">${escapeHtml(snippet.title)}</div>
            <div class="snippet-card-meta">
                <span class="snippet-card-category">${snippet.category || 'other'}</span>
                <span class="snippet-card-date">${formatDate(snippet.updatedAt)}</span>
            </div>
        </div>
    `).join('');

    elements.snippetsList.querySelectorAll('.snippet-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="delete"]')) {
                deleteSnippet(e.target.closest('[data-action="delete"]').dataset.id);
            } else {
                loadSnippet(card.dataset.id);
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            }
        });
    });
}

function loadSnippet(id) {
    const snippet = state.snippets.find(s => s.id === id);
    if (!snippet) return;

    state.currentSnippetId = id;
    elements.editor.value = snippet.html;

    updateTitle(snippet.title);
    updateLineNumbers();
    updatePreview();
    updateStats();
    renderSnippetsList();
    setStatus('Loaded');
}

function deleteSnippet(id) {
    if (!confirm('Delete this snippet?')) return;

    state.snippets = state.snippets.filter(s => s.id !== id);

    if (state.currentSnippetId === id) {
        state.currentSnippetId = null;
        elements.editor.value = '';
        updateTitle('');
        updateLineNumbers();
        updatePreview();
    }

    saveSnippetsToStorage();
    renderSnippetsList();
    showToast('Deleted', 'success');
}

function filterSnippets() {
    renderSnippetsList();
}

// ========================================
// Import/Export
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
                throw new Error('Invalid format');
            }

            const importedCount = data.snippets.length;
            data.snippets.forEach(snippet => {
                snippet.id = generateId();
            });

            state.snippets = [...data.snippets, ...state.snippets];
            saveSnippetsToStorage();
            renderSnippetsList();

            showToast(`Imported ${importedCount} snippets`, 'success');
        } catch (err) {
            showToast('Invalid file format', 'error');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ========================================
// File System Access API
// ========================================
async function saveToFolder() {
    const html = elements.editor.value;
    const title = elements.currentTitle.value || 'snippet';

    if (!('showSaveFilePicker' in window)) {
        downloadHTML();
        return;
    }

    try {
        const filename = title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') + '.html';

        const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'HTML Files',
                accept: { 'text/html': ['.html'] }
            }]
        });

        const writable = await handle.createWritable();

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

        state.fileHandle = handle;
        showToast(`Saved: ${handle.name}`, 'success');
    } catch (err) {
        if (err.name !== 'AbortError') {
            showToast('Failed to save', 'error');
        }
    }
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

// ========================================
// Utility Functions
// ========================================
function setupResizer() {
    let isResizing = false;
    const editorPanel = elements.editorPanel;
    const previewPanel = elements.previewPanel;

    elements.resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        elements.resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = elements.editorContainer.getBoundingClientRect();
        const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (window.innerWidth <= 768) {
            elements.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
        }
    }
}

function setStatus(text) {
    elements.statusText.textContent = text;
    setTimeout(() => {
        if (elements.statusText.textContent === text) {
            elements.statusText.textContent = 'Ready';
        }
    }, 2000);
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
    }, 2000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateForFile(date) {
    return date.toISOString().split('T')[0];
}

// ========================================
// Start Application
// ========================================
document.addEventListener('DOMContentLoaded', init);
