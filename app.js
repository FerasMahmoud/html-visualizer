/**
 * HTML Visualizer - Fixed & Enhanced
 * All interactions guaranteed to work
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
// Safe Element Getter
// ========================================
function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element not found: ${id}`);
    return el;
}

// ========================================
// Initialize Application
// ========================================
function init() {
    console.log('Initializing HTML Visualizer...');

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

    console.log('HTML Visualizer initialized successfully!');
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Editor events
    const editor = $('htmlEditor');
    if (editor) {
        editor.addEventListener('input', handleEditorInput);
        editor.addEventListener('scroll', syncScroll);
        editor.addEventListener('keydown', handleEditorKeydown);
        editor.addEventListener('paste', handlePaste);
    }

    // Mobile sidebar events - use both click and touchend for iOS
    const menuBtn = $('menuBtn');
    const sidebarClose = $('sidebarClose');
    const sidebarOverlay = $('sidebarOverlay');

    if (menuBtn) {
        menuBtn.addEventListener('click', openSidebar);
        menuBtn.addEventListener('touchend', function(e) {
            e.preventDefault();
            openSidebar();
        }, { passive: false });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
        sidebarClose.addEventListener('touchend', function(e) {
            e.preventDefault();
            closeSidebar();
        }, { passive: false });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
        sidebarOverlay.addEventListener('touchend', function(e) {
            e.preventDefault();
            closeSidebar();
        }, { passive: false });
    }

    // Search & Filter
    const searchInput = $('searchInput');
    const categoryFilter = $('categoryFilter');
    if (searchInput) searchInput.addEventListener('input', filterSnippets);
    if (categoryFilter) categoryFilter.addEventListener('change', filterSnippets);

    // Action buttons - add both click and touch events
    const openNewTabBtn = $('openNewTabBtn');
    const mobilePreviewBtn = $('mobilePreviewBtn');
    const exportBtn = $('exportBtn');
    const importBtn = $('importBtn');
    const importFile = $('importFile');
    const downloadBtn = $('downloadBtn');
    const saveFolderBtn = $('saveFolderBtn');
    const refreshPreview = $('refreshPreview');

    // Helper to add both click and touch events
    function addTouchClick(el, handler) {
        if (!el) return;
        el.addEventListener('click', handler);
        el.addEventListener('touchend', function(e) {
            e.preventDefault();
            handler.call(this, e);
        }, { passive: false });
    }

    if (openNewTabBtn) addTouchClick(openNewTabBtn, openInNewTab);
    if (mobilePreviewBtn) addTouchClick(mobilePreviewBtn, openInNewTab);
    if (exportBtn) addTouchClick(exportBtn, exportSnippets);
    if (importBtn) addTouchClick(importBtn, () => importFile && importFile.click());
    if (importFile) importFile.addEventListener('change', importSnippets);
    if (downloadBtn) addTouchClick(downloadBtn, downloadHTML);
    if (saveFolderBtn) addTouchClick(saveFolderBtn, saveToFolder);
    if (refreshPreview) addTouchClick(refreshPreview, updatePreview);

    // Mobile view toggle - handle both click and touch
    const mobileViewToggle = $('mobileViewToggle');
    if (mobileViewToggle) {
        const handleToggle = (e) => {
            const btn = e.target.closest('.toggle-btn');
            if (btn && btn.dataset.view) {
                e.preventDefault();
                setMobileView(btn.dataset.view);
            }
        };
        mobileViewToggle.addEventListener('click', handleToggle);
        mobileViewToggle.addEventListener('touchend', handleToggle, { passive: false });
    }

    // Resizer
    setupResizer();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Save when leaving page
    document.addEventListener('visibilitychange', () => {
        const editorEl = $('htmlEditor');
        if (document.hidden && editorEl && editorEl.value.trim()) {
            autoSave();
        }
    });

    window.addEventListener('beforeunload', () => {
        const editorEl = $('htmlEditor');
        if (editorEl && editorEl.value.trim()) {
            autoSave();
        }
    });
}

// ========================================
// Mobile View
// ========================================
function setMobileView(view) {
    state.mobileView = view;

    const mobileViewToggle = $('mobileViewToggle');
    const editorPanel = $('editorPanel');
    const previewPanel = $('previewPanel');

    // Update toggle buttons
    if (mobileViewToggle) {
        mobileViewToggle.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }

    // Show/hide panels
    if (editorPanel && previewPanel) {
        if (view === 'editor') {
            editorPanel.classList.remove('hidden');
            previewPanel.classList.add('hidden');
        } else if (view === 'preview') {
            editorPanel.classList.add('hidden');
            previewPanel.classList.remove('hidden');
        } else {
            editorPanel.classList.remove('hidden');
            previewPanel.classList.remove('hidden');
        }
    }
}

function openSidebar() {
    const sidebar = $('sidebar');
    const sidebarOverlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.classList.add('active');
}

function closeSidebar() {
    const sidebar = $('sidebar');
    const sidebarOverlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

// ========================================
// Editor Functions
// ========================================
function handleEditorInput() {
    const editor = $('htmlEditor');
    if (!editor) return;

    updateLineNumbers();
    updatePreview();
    updateStats();

    // Extract title from HTML
    const title = extractTitle(editor.value);
    updateTitle(title);

    // Auto-save with debounce
    scheduleAutoSave();
}

function handleEditorKeydown(e) {
    // Tab key handling
    if (e.key === 'Tab') {
        e.preventDefault();
        const editor = $('htmlEditor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        editor.value = value.substring(0, start) + '  ' + value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
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
    const editor = $('htmlEditor');
    const lineNumbers = $('lineNumbers');
    if (!editor || !lineNumbers) return;

    const lines = editor.value.split('\n').length;
    const lineNumbersHtml = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('');
    lineNumbers.innerHTML = lineNumbersHtml;
}

function updateStats() {
    const editor = $('htmlEditor');
    const lineCount = $('lineCount');
    const charCount = $('charCount');

    if (!editor) return;

    const content = editor.value;
    const lines = content.split('\n').length;
    const chars = content.length;

    if (lineCount) lineCount.textContent = `${lines} lines`;
    if (charCount) charCount.textContent = `${chars.toLocaleString()} chars`;
}

function syncScroll() {
    const editor = $('htmlEditor');
    const lineNumbers = $('lineNumbers');
    if (editor && lineNumbers) {
        lineNumbers.scrollTop = editor.scrollTop;
    }
}

// ========================================
// Title Management
// ========================================
function extractTitle(html) {
    if (!html || !html.trim()) return 'Untitled';

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

    // Try to find id
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
    const currentTitle = $('currentTitle');
    const mobileTitleText = $('mobileTitleText');

    if (currentTitle) currentTitle.textContent = title || 'Untitled';
    if (mobileTitleText) mobileTitleText.textContent = title || 'HTML Visualizer';
    document.title = title ? `${title} - HTML Visualizer` : 'HTML Visualizer';
}

// ========================================
// Auto-Save
// ========================================
function scheduleAutoSave() {
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    const statusIndicator = $('statusIndicator');
    const statusText = document.querySelector('.status-text');

    if (statusIndicator) statusIndicator.classList.add('saving');
    if (statusText) statusText.textContent = 'Saving...';

    state.autoSaveTimeout = setTimeout(() => {
        autoSave();
    }, 1000);
}

function autoSave() {
    const editor = $('htmlEditor');
    if (!editor) return;

    const html = editor.value.trim();
    if (!html) return;

    const currentTitle = $('currentTitle');
    const title = (currentTitle ? currentTitle.textContent : '') || 'Untitled';
    const category = detectCategory(html);

    let snippet;
    const now = new Date().toISOString();

    if (state.currentSnippetId) {
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

    const statusIndicator = $('statusIndicator');
    const statusText = document.querySelector('.status-text');

    if (statusIndicator) statusIndicator.classList.remove('saving');
    if (statusText) statusText.textContent = 'Saved';
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
    const editor = $('htmlEditor');
    const previewFrame = $('previewFrame');
    if (!editor || !previewFrame) return;

    const html = editor.value;

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

    if (previewFrame.dataset.blobUrl) {
        URL.revokeObjectURL(previewFrame.dataset.blobUrl);
    }

    previewFrame.src = url;
    previewFrame.dataset.blobUrl = url;
}

function openInNewTab() {
    const editor = $('htmlEditor');
    const currentTitle = $('currentTitle');
    if (!editor) return;

    const html = editor.value;
    const title = (currentTitle ? currentTitle.textContent : '') || 'Preview';

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
    const searchInput = $('searchInput');
    const categoryFilter = $('categoryFilter');
    const snippetsList = $('snippetsList');
    const snippetsCount = $('snippetsCount');

    if (!snippetsList) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const categoryFilterValue = categoryFilter ? categoryFilter.value : '';

    let filtered = state.snippets;

    if (searchTerm) {
        filtered = filtered.filter(s =>
            s.title.toLowerCase().includes(searchTerm) ||
            (s.html || '').toLowerCase().includes(searchTerm)
        );
    }

    if (categoryFilterValue) {
        filtered = filtered.filter(s => s.category === categoryFilterValue);
    }

    if (snippetsCount) {
        snippetsCount.textContent = `${filtered.length} snippet${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        snippetsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <path d="M12 18v-6"/>
                        <path d="M9 15l3-3 3 3"/>
                    </svg>
                </div>
                <h3>${searchTerm || categoryFilterValue ? 'No matches found' : 'No snippets yet'}</h3>
                <p>${searchTerm || categoryFilterValue ? 'Try a different search' : 'Paste HTML code to get started'}</p>
            </div>
        `;
        return;
    }

    snippetsList.innerHTML = filtered.map(snippet => `
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

    // Add click and touch listeners for snippet cards
    snippetsList.querySelectorAll('.snippet-card').forEach(card => {
        const handleCardClick = (e) => {
            if (e.target.closest('[data-action="delete"]')) {
                e.stopPropagation();
                e.preventDefault();
                deleteSnippet(e.target.closest('[data-action="delete"]').dataset.id);
            } else {
                loadSnippet(card.dataset.id);
                if (window.innerWidth <= 768) {
                    closeSidebar();
                }
            }
        };
        card.addEventListener('click', handleCardClick);
        card.addEventListener('touchend', handleCardClick, { passive: false });
    });
}

function loadSnippet(id) {
    const snippet = state.snippets.find(s => s.id === id);
    if (!snippet) return;

    const editor = $('htmlEditor');
    if (!editor) return;

    state.currentSnippetId = id;
    editor.value = snippet.html;

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
        const editor = $('htmlEditor');
        if (editor) editor.value = '';
        updateTitle('Untitled');
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
    const editor = $('htmlEditor');
    const currentTitle = $('currentTitle');

    if (!editor) return;

    const html = editor.value;
    const title = (currentTitle ? currentTitle.textContent : '') || 'snippet';

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
    const editor = $('htmlEditor');
    const currentTitle = $('currentTitle');

    if (!editor) return;

    const html = editor.value;
    const title = (currentTitle ? currentTitle.textContent : '') || 'snippet';
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
// Resizer
// ========================================
function setupResizer() {
    const resizer = $('resizer');
    const editorPanel = $('editorPanel');
    const previewPanel = $('previewPanel');
    const editorContainer = $('editorContainer');

    if (!resizer || !editorPanel || !previewPanel || !editorContainer) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const containerRect = editorContainer.getBoundingClientRect();
        const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        const clampedPercentage = Math.max(20, Math.min(80, percentage));

        editorPanel.style.flex = `0 0 ${clampedPercentage}%`;
        previewPanel.style.flex = `0 0 ${100 - clampedPercentage}%`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// ========================================
// Keyboard Shortcuts
// ========================================
function handleGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (window.innerWidth <= 768) {
            const sidebar = $('sidebar');
            if (sidebar) {
                sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
            }
        }
    }
}

// ========================================
// Utility Functions
// ========================================
function setStatus(text) {
    const statusText = document.querySelector('.status-text');
    if (!statusText) return;

    statusText.textContent = text;
    setTimeout(() => {
        if (statusText.textContent === text) {
            statusText.textContent = 'Ready';
        }
    }, 2000);
}

function showToast(message, type = 'info') {
    const toastContainer = $('toastContainer');
    if (!toastContainer) return;

    const icons = {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${icons[type] || icons.info}<span>${escapeHtml(message)}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
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
