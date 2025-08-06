// guide_url.js

/** ===========================================================================
 * Chrome Storage API Wrapper
 * ========================================================================= */
const storage = {
    async get() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['guides', 'guides_base'], (result) => {
                resolve({
                    guides: result.guides || [],
                    baseCards: result.guides_base || []
                });
            });
        });
    },
    async save(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set({
                guides: data.guides,
                guides_base: data.baseCards
            }, resolve);
        });
    }
};

/** ===========================================================================
 * Global State
 * ========================================================================= */
let state = {
    guides: [],
    baseCards: []
};

/** ===========================================================================
 * UI Elements
 * ========================================================================= */
const elements = {
    baseCardsList: null,
    guidesList: null,
    newGuideModal: null,
    importExportModal: null,
    newGuideForm: null,
    guideCardsContainer: null
};

/** ===========================================================================
 * i18n Utility
 * ---------------------------------------------------------------------------
 *  - data-i18n="xxx" を chrome.i18n.getMessage(xxx) で置換
 *  - 動的に生成したDOM内でも呼べるように汎用関数化
 * ========================================================================= */
function localizeAll(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        const msg = chrome.i18n.getMessage(key);
        if (msg) {
            el.textContent = msg;
        }
    });
}

/** ===========================================================================
 * Main UI Render
 * ========================================================================= */
function renderUI() {
    renderBaseCards();
    renderGuides();
    attachEventListeners();
    // レンダ後に i18n を適用
    localizeAll();
}

/** ===========================================================================
 * Render Base Cards
 * ========================================================================= */
function renderBaseCards() {
    elements.baseCardsList.innerHTML = state.baseCards
        .map((card, index) => `
            <div class="guide-card" data-index="${index}">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-medium">${index + 1}: ${card.title}</span>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-secondary move-base-up"
                                ${index === 0 ? 'disabled' : ''}>
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary move-base-down"
                                ${index === state.baseCards.length - 1 ? 'disabled' : ''}>
                            <i class="bi bi-arrow-down"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-base">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary delete-base">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `)
        .join('');
}

/** ===========================================================================
 * Render Guides (URL Guides + their cards)
 * ========================================================================= */
function renderGuides() {
    elements.guidesList.innerHTML = state.guides
        .map((guide, index) => `
            <div class="guide-card" data-index="${index}">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">${guide.guideUrl}</h6>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline-secondary move-guide-up"
                                ${index === 0 ? 'disabled' : ''}>
                            <i class="bi bi-arrow-up"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary move-guide-down"
                                ${index === state.guides.length - 1 ? 'disabled' : ''}>
                            <i class="bi bi-arrow-down"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-guide">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary delete-guide">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="guide-card-list">
                    ${guide.guideCards
                        .map((card, cardIndex) => `
                            <div class="d-flex justify-content-between align-items-center" data-card-index="${cardIndex}">
                                <span>${cardIndex + 1}: ${card.title}</span>
                                <div class="action-buttons">
                                    <button class="btn btn-sm btn-outline-secondary move-card-up"
                                            ${cardIndex === 0 ? 'disabled' : ''}>
                                        <i class="bi bi-arrow-up"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary move-card-down"
                                            ${cardIndex === guide.guideCards.length - 1 ? 'disabled' : ''}>
                                        <i class="bi bi-arrow-down"></i>
                                    </button>
                                </div>
                            </div>
                        `)
                        .join('')}
                </div>
            </div>
        `)
        .join('');
}

/** ===========================================================================
 * Attach Event Listeners (Base & Guide)
 * ========================================================================= */
function attachEventListeners() {
    // Base card
    elements.baseCardsList.querySelectorAll('.move-base-up, .move-base-down').forEach(btn => {
        btn.addEventListener('click', handleBaseCardMove);
    });
    elements.baseCardsList.querySelectorAll('.edit-base').forEach(btn => {
        btn.addEventListener('click', handleBaseCardEdit);
    });
    elements.baseCardsList.querySelectorAll('.delete-base').forEach(btn => {
        btn.addEventListener('click', handleBaseCardDelete);
    });

    // Guide
    elements.guidesList.querySelectorAll('.move-guide-up, .move-guide-down').forEach(btn => {
        btn.addEventListener('click', handleGuideMove);
    });
    elements.guidesList.querySelectorAll('.edit-guide').forEach(btn => {
        btn.addEventListener('click', handleGuideEdit);
    });
    elements.guidesList.querySelectorAll('.delete-guide').forEach(btn => {
        btn.addEventListener('click', handleGuideDelete);
    });

    // Guide card movement
    elements.guidesList.querySelectorAll('.move-card-up, .move-card-down').forEach(btn => {
        btn.addEventListener('click', handleGuideCardMove);
    });
}

/** ===========================================================================
 * Event Handlers (Base Cards)
 * ========================================================================= */
function handleBaseCardMove(e) {
    const index = parseInt(e.target.closest('.guide-card').dataset.index, 10);
    const direction = e.target.closest('.move-base-up') ? 'up' : 'down';
    moveBaseCard(index, direction);
}

function handleBaseCardEdit(e) {
    const index = parseInt(e.target.closest('.guide-card').dataset.index, 10);
    editBaseCard(index);
}

function handleBaseCardDelete(e) {
    const index = parseInt(e.target.closest('.guide-card').dataset.index, 10);
    deleteBaseCard(index);
}

/** ===========================================================================
 * Event Handlers (Guides)
 * ========================================================================= */
function handleGuideMove(e) {
    e.stopPropagation();
    const guideCard = e.target.closest('.guide-card');
    const index = parseInt(guideCard.dataset.index, 10);
    const direction = e.target.closest('.move-guide-up') ? 'up' : 'down';
    moveGuide(index, direction);
}

function handleGuideEdit(e) {
    const index = parseInt(e.target.closest('.guide-card').dataset.index, 10);
    editGuide(index);
}

function handleGuideDelete(e) {
    const index = parseInt(e.target.closest('.guide-card').dataset.index, 10);
    deleteGuide(index);
}

/** ===========================================================================
 * Event Handlers (Guide Cards)
 * ========================================================================= */
function handleGuideCardMove(e) {
    const guideCard = e.target.closest('.guide-card');
    const cardElement = e.target.closest('[data-card-index]');
    const guideIndex = parseInt(guideCard.dataset.index, 10);
    const cardIndex = parseInt(cardElement.dataset.cardIndex, 10);
    const direction = e.target.closest('.move-card-up') ? 'up' : 'down';
    moveGuideCard(guideIndex, cardIndex, direction);
}

/** ===========================================================================
 * Initialize Global Event Listeners (Buttons outside the lists)
 * ========================================================================= */
function initializeEventListeners() {
    const newBaseCardBtn = document.getElementById('newBaseCardBtn');
    const newGuideBtn = document.getElementById('newGuideBtn');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const addCardBtn = document.getElementById('addCardBtn');
    const saveGuideBtn = document.getElementById('saveGuideBtn');

    if (newBaseCardBtn) {
        newBaseCardBtn.addEventListener('click', () => showBaseCardModal());
    }
    if (newGuideBtn) {
        newGuideBtn.addEventListener('click', showNewGuideModal);
    }
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            // 他のモーダルが開いていれば閉じる
            const baseCardModalEl = document.getElementById('baseCardModal');
            if (baseCardModalEl) {
                const baseCardModalInstance = bootstrap.Modal.getInstance(baseCardModalEl);
                if (baseCardModalInstance) baseCardModalInstance.hide();
            }

            updateImportExportModalHTML();
            const importExportModalEl = document.getElementById('importExportModal');
            const importExportModal = new bootstrap.Modal(importExportModalEl);
            
            // Fix aria-hidden accessibility issue
            importExportModalEl.addEventListener('shown.bs.modal', function () {
                // Remove aria-hidden from the modal to fix accessibility issue
                this.removeAttribute('aria-hidden');
            });
            
            importExportModal.show();
        });
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    if (addCardBtn) {
        addCardBtn.addEventListener('click', addNewGuideCard);
    }
    if (saveGuideBtn) {
        saveGuideBtn.addEventListener('click', saveNewGuide);
    }
}

/** ===========================================================================
 * App Initialization
 * ========================================================================= */
async function initializeApp() {
    try {
        // Get references
        elements.baseCardsList = document.getElementById('baseCardsList');
        elements.guidesList = document.getElementById('guidesList');
        elements.newGuideForm = document.getElementById('newGuideForm');
        elements.guideCardsContainer = document.getElementById('guideCardsContainer');

        // Bootstrap modals
        const newGuideModalEl = document.getElementById('newGuideModal');
        if (newGuideModalEl) {
            elements.newGuideModal = new bootstrap.Modal(newGuideModalEl);
            
            // Fix aria-hidden accessibility issue
            newGuideModalEl.addEventListener('shown.bs.modal', function () {
                // Remove aria-hidden from the modal to fix accessibility issue
                this.removeAttribute('aria-hidden');
                // Focus the first input field
                const firstInput = this.querySelector('#newGuideUrl');
                if (firstInput) {
                    firstInput.focus();
                }
            });
        }

        // Load data & render
        const data = await storage.get();
        state = data;
        renderUI();

        // Setup event listeners
        initializeEventListeners();

        // Setup import/export
        setupImportExport();

        // 最後にページ全体をi18n
        localizeAll(document);
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

/** ===========================================================================
 * Modal Functions (New Guide)
 * ========================================================================= */
function showNewGuideModal() {
    const guideUrlInput = document.getElementById('newGuideUrl');
    if (guideUrlInput) {
        guideUrlInput.value = '';
    }
    
    if (elements.guideCardsContainer) {
        elements.guideCardsContainer.innerHTML = '';
        addNewGuideCard();
    }
    
    // saveGuideBtn の再登録
    const saveButton = document.getElementById('saveGuideBtn');
    if (saveButton) {
        const newSaveButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newSaveButton, saveButton);
        document.getElementById('saveGuideBtn').addEventListener('click', saveNewGuide);
    }
    
    if (elements.newGuideModal) {
        elements.newGuideModal.show();
    }
}

/** 
 * Add new guide card input to the "New Guide" form (max 5)
 */
function addNewGuideCard() {
    const cardCount = elements.guideCardsContainer.children.length;
    if (cardCount >= 5) return;

    const cardElement = document.createElement('div');
    cardElement.className = 'guide-card mb-3';
    cardElement.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6>${cardCount + 1}:</h6>
            ${cardCount > 0 ? `
            <button type="button" class="btn btn-sm btn-outline-danger remove-card">
                <i class="bi bi-x-lg"></i>
            </button>` : ''}
        </div>
        <div class="mb-2">
            <label class="form-label">guide_title:</label>
            <input type="text" class="form-control guide-title" required>
        </div>
        <!-- Promptは将来的に使用予定のためコメントアウト中
        <div class="mb-2">
            <label class="form-label">guide_prompt:</label>
            <textarea class="form-control guide-prompt" rows="3" required></textarea>
        </div>
        -->
        <div class="mb-2">
            <label class="form-label">guide_memo:</label>
            <input type="text" class="form-control guide-memo">
        </div>
    `;

    if (cardCount > 0) {
        const removeButton = cardElement.querySelector('.remove-card');
        removeButton.addEventListener('click', () => {
            cardElement.remove();
            updateCardNumbers();
        });
    }

    elements.guideCardsContainer.appendChild(cardElement);
}

/** 
 * Update card numbering (1-based)
 */
function updateCardNumbers() {
    const cards = elements.guideCardsContainer.children;
    Array.from(cards).forEach((card, index) => {
        const header = card.querySelector('h6');
        header.textContent = `${index + 1}:`;
    });
}

/** ===========================================================================
 * Save (New Guide)
 * ========================================================================= */
async function saveNewGuide() {
    const guideUrl = document.getElementById('newGuideUrl').value;
    if (!validateGuideUrl(guideUrl)) {
        alert(chrome.i18n.getMessage('invalidUrlFormat'));
        return;
    }

    // Duplicate check
    const isDuplicate = state.guides.some(guide => guide.guideUrl === guideUrl);
    if (isDuplicate) {
        alert('This URL pattern already exists');
        return;
    }

    const cardElements = elements.guideCardsContainer.children;
    if (cardElements.length === 0) {
        alert('At least one guide card is required');
        return;
    }

    const guideCards = Array.from(cardElements).map(card => ({
        title: card.querySelector('.guide-title').value,
        prompt: '', // Promptは空
        memo: card.querySelector('.guide-memo').value
    }));

    if (!validateGuideCards(guideCards)) {
        alert('Please fill in all required fields');
        return;
    }

    state.guides.push({
        id: Date.now(),
        guideUrl,
        guideCards
    });

    await storage.save(state);
    elements.newGuideModal.hide();
    renderUI();
}

/** ===========================================================================
 * Validation
 * ========================================================================= */
function validateGuideUrl(url) {
    return url.startsWith('https://');
}

function validateGuideCards(cards) {
    return cards.every(card => card.title);
}

/** ===========================================================================
 * Import/Export Modal HTML + i18n
 * ========================================================================= */
function updateImportExportModalHTML() {
    const modalHtml = `
        <div class="modal fade" id="importExportModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <!-- 例: data-i18n="importExportData" -->
                        <h5 class="modal-title" id="importExportModalLabel">
                            <span data-i18n="importExportData"></span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="file" id="fileInput" accept=".yml,.yaml" style="display: none">
                        <div id="uploadArea" class="border rounded p-3 text-center mb-3" 
                             style="cursor: pointer; min-height: 100px;">
                            <i class="bi bi-cloud-upload fs-2 mb-2"></i>
                            <!-- 例: data-i18n="dropYamlFile" -->
                            <p class="mb-0"><span data-i18n="dropYamlFile"></span></p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" data-i18n="cancel">
                            キャンセル
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('importExportModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // i18n 適用
    const newModal = document.getElementById('importExportModal');
    localizeAll(newModal);

    setupImportHandlers();
}

/** ===========================================================================
 * Drag & Drop Handlers
 * ========================================================================= */
function setupImportHandlers() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('border-primary');
            uploadArea.style.backgroundColor = '#f8f9fa';
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('border-primary');
            uploadArea.style.backgroundColor = '';
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        handleFileSelection(file);
    });

    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFileSelection(file);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFileSelection(file) {
    if (!file) return;
    if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
        handleImport(file);
    } else {
        alert('YAMLファイル(.yml または .yaml)を選択してください');
    }
}

/** ===========================================================================
 * Export (YAML)
 * ========================================================================= */
function handleExport() {
    try {
        const yamlContent = jsyaml.dump(state);
        const blob = new Blob([yamlContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `guide_export_${new Date().toISOString().slice(0,10)}.yml`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Export error:', error);
        alert('エクスポート中にエラーが発生しました');
    }
}

/** ===========================================================================
 * validateImportData (promptを必須から外す)
 * ========================================================================= */
function validateImportData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.guides) || !Array.isArray(data.baseCards)) return false;

    // guides
    if (
        !data.guides.every(guide => {
            return (
                typeof guide.guideUrl === 'string' &&
                guide.guideUrl.startsWith('https://') &&
                Array.isArray(guide.guideCards) &&
                guide.guideCards.length <= 5 &&
                guide.guideCards.every(card => 
                    typeof card.title === 'string' &&
                    card.title.trim() !== '' &&
                    (card.prompt === undefined || typeof card.prompt === 'string') &&
                    (!card.memo || typeof card.memo === 'string')
                )
            );
        })
    ) {
        return false;
    }

    // baseCards
    if (data.baseCards.length > 5) return false;
    if (
        !data.baseCards.every(card =>
            typeof card.title === 'string' &&
            card.title.trim() !== '' &&
            (card.prompt === undefined || typeof card.prompt === 'string') &&
            (!card.memo || typeof card.memo === 'string')
        )
    ) {
        return false;
    }

    // URL 重複チェック
    const urls = data.guides.map(g => g.guideUrl);
    if (new Set(urls).size !== urls.length) return false;

    return true;
}

/** ===========================================================================
 * Import (YAML -> state)
 * ========================================================================= */
async function handleImport(file) {
    try {
        const content = await file.text();
        const importedData = jsyaml.load(content);

        if (!validateImportData(importedData)) {
            throw new Error('Invalid YAML format or data structure');
        }

        // 既存URLとの重複
        const existingUrls = new Set(state.guides.map(g => g.guideUrl));
        const hasConflicts = importedData.guides.some(g => existingUrls.has(g.guideUrl));
        if (hasConflicts) {
            throw new Error('Duplicate URL patterns found');
        }

        // stateにマージ
        state = {
            guides: [...state.guides, ...importedData.guides],
            baseCards: [...state.baseCards, ...importedData.baseCards].slice(0, 5)
        };

        await storage.save(state);

        const importExportModal = bootstrap.Modal.getInstance(document.getElementById('importExportModal'));
        importExportModal.hide();
        renderUI();
        alert('インポートが完了しました');
    } catch (error) {
        console.error('Import error:', error);
        alert(`インポートエラー: ${error.message}`);
    }
}

/** ===========================================================================
 * モーダル多重表示対策用の初期化 (リスナーはすでにinitializeEventListenersで対応)
 * ========================================================================= */
function setupImportExport() {
    // 現状、特に追加処理なし
}

/** ===========================================================================
 * Move Functions
 * ========================================================================= */
async function moveBaseCard(index, direction) {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.baseCards.length) return;

    const cards = [...state.baseCards];
    [cards[index], cards[newIndex]] = [cards[newIndex], cards[index]];
    state.baseCards = cards;

    await storage.save(state);
    renderUI();
}

async function moveGuide(index, direction) {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.guides.length) return;

    const guides = [...state.guides];
    [guides[index], guides[newIndex]] = [guides[newIndex], guides[index]];
    state.guides = guides;

    await storage.save(state);
    renderUI();
}

async function moveGuideCard(guideIndex, cardIndex, direction) {
    const newIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
    if (newIndex < 0 || newIndex >= state.guides[guideIndex].guideCards.length) return;

    const guideCards = [...state.guides[guideIndex].guideCards];
    [guideCards[cardIndex], guideCards[newIndex]] = [guideCards[newIndex], guideCards[cardIndex]];
    state.guides[guideIndex].guideCards = guideCards;

    await storage.save(state);
    renderUI();
}

/** ===========================================================================
 * Edit / Delete (Guide)
 * ========================================================================= */
async function editGuide(index) {
    const guide = state.guides[index];
    document.getElementById('newGuideUrl').value = guide.guideUrl;
    elements.guideCardsContainer.innerHTML = '';

    guide.guideCards.forEach(() => addNewGuideCard());
    const cardElements = elements.guideCardsContainer.children;
    guide.guideCards.forEach((card, i) => {
        const cardEl = cardElements[i];
        cardEl.querySelector('.guide-title').value = card.title;
        cardEl.querySelector('.guide-memo').value = card.memo || '';
    });

    const saveButton = document.getElementById('saveGuideBtn');
    saveButton.replaceWith(saveButton.cloneNode(true));
    document.getElementById('saveGuideBtn').addEventListener('click', async () => {
        await updateGuide(index);
    });
    
    elements.newGuideModal.show();
}

async function updateGuide(index) {
    const guideUrl = document.getElementById('newGuideUrl').value;
    if (!validateGuideUrl(guideUrl)) {
        alert('Invalid URL format');
        return;
    }
    const isDuplicate = state.guides.some((guide, i) => i !== index && guide.guideUrl === guideUrl);
    if (isDuplicate) {
        alert('This URL pattern already exists');
        return;
    }

    const cardElements = elements.guideCardsContainer.children;
    if (cardElements.length === 0) {
        alert('At least one guide card is required');
        return;
    }

    const guideCards = Array.from(cardElements).map(card => ({
        title: card.querySelector('.guide-title').value,
        prompt: '',
        memo: card.querySelector('.guide-memo').value
    }));

    if (!validateGuideCards(guideCards)) {
        alert('Please fill in all required fields');
        return;
    }

    const updatedGuide = {
        ...state.guides[index],
        guideUrl,
        guideCards
    };

    state.guides[index] = updatedGuide;
    await storage.save(state);
    elements.newGuideModal.hide();
    renderUI();
}

async function deleteGuide(index) {
    if (!confirm('このURLガイドを削除してもよろしいですか？')) return;
    state.guides.splice(index, 1);
    await storage.save(state);
    renderUI();
}

/** ===========================================================================
 * Edit / Delete (BaseCards)
 * ========================================================================= */
function editBaseCard(index) {
    const card = state.baseCards[index];
    showBaseCardModal(card, index);
}

function showBaseCardModal(card = null, editIndex = -1) {
    const isEdit = card !== null;
    const modalHtml = `
        <div class="modal fade" id="baseCardModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <span data-i18n="${isEdit ? 'editBaseCard' : 'newBaseCard'}"></span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="baseCardForm">
                            <div class="mb-3">
                                <label class="form-label">guide_title:</label>
                                <input type="text" class="form-control" id="baseCardTitle"
                                       value="${card ? card.title : ''}" required>
                            </div>
                            <!-- Promptは将来的に使用予定
                            <div class="mb-3">
                                <label class="form-label">guide_prompt:</label>
                                <textarea class="form-control" id="baseCardPrompt" rows="3" required>
                                    ${card ? card.prompt : ''}
                                </textarea>
                            </div>
                            -->
                            <div class="mb-3">
                                <label class="form-label">guide_memo:</label>
                                <input type="text" class="form-control" id="baseCardMemo"
                                       value="${card ? (card.memo || '') : ''}">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <!-- data-i18n="cancel" / data-i18n="save" があれば置き換わる -->
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" data-i18n="cancel">
                            キャンセル
                        </button>
                        <button type="button" class="btn btn-primary" id="saveBaseCardBtn" data-i18n="save">
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('baseCardModal');
    if (existingModal) {
        existingModal.remove();
    }

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // i18n適用
    const newlyInserted = document.getElementById('baseCardModal');
    localizeAll(newlyInserted);

    const modal = new bootstrap.Modal(newlyInserted);
    document.getElementById('saveBaseCardBtn').addEventListener('click', async () => {
        const title = document.getElementById('baseCardTitle').value;
        const prompt = ''; // promptは未使用
        const memo = document.getElementById('baseCardMemo').value;

        if (!title) {
            alert('必須項目を入力してください');
            return;
        }

        if (isEdit) {
            state.baseCards[editIndex] = { title, prompt, memo };
        } else {
            if (state.baseCards.length >= 5) {
                alert('ベースカードは最大5件までです');
                return;
            }
            state.baseCards.push({ title, prompt, memo });
        }

        await storage.save(state);
        modal.hide();
        renderUI();
    });

    // Fix aria-hidden accessibility issue
    newlyInserted.addEventListener('shown.bs.modal', function () {
        // Remove aria-hidden from the modal to fix accessibility issue
        this.removeAttribute('aria-hidden');
        // Focus the first input field
        const firstInput = this.querySelector('#baseCardTitle');
        if (firstInput) {
            firstInput.focus();
        }
    });

    modal.show();
}

async function deleteBaseCard(index) {
    if (!confirm(chrome.i18n.getMessage('confirmDeleteBaseCard'))) return;
    state.baseCards.splice(index, 1);
    await storage.save(state);
    renderUI();
}

/** ===========================================================================
 * Additional URL Pattern Validation (Optional)
 * ========================================================================= */
function validateUrlPattern(url) {
    try {
        return url.startsWith('https://');
    } catch (error) {
        console.error('URL pattern validation error:', error);
        return false;
    }
}

/** ===========================================================================
 * DOMContentLoaded
 * ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch(console.error);

    // フォームタブ関連
    const formTab = document.getElementById('form-tab');
    const readFormButton = document.getElementById('readFormButton');
    const insertFormButton = document.getElementById('insertFormButton');
    const formStatus = document.getElementById('formStatus');
    const formElements = document.getElementById('formElements');

    if (formTab) {
        formTab.addEventListener('shown.bs.tab', async () => {
            const result = await storage.get(['apiProvider']);
            if (result.apiProvider === 'local') {
                readFormButton.disabled = false;
                formStatus.textContent = 'フォームを読み込んでください';
            } else {
                readFormButton.disabled = true;
                formStatus.textContent = 'このモードではフォーム機能は使用できません';
            }
        });
    }

    // フォーム制御のスクリプトを動的に読み込み
    const formControlScript = document.createElement('script');
    formControlScript.src = 'form_control.js';
    formControlScript.type = 'module';
    document.body.appendChild(formControlScript);
});
