document.addEventListener('DOMContentLoaded', () => {
    const searchContainer = document.querySelector('.search-container');
    const searchInput = document.getElementById('searchInput');

    if (searchContainer && searchInput) {
        // Wenn in die Searchbar geklickt/fokussiert wird
        searchInput.addEventListener('focus', () => {
            searchContainer.classList.add('is-focused');
        });

        // Wenn irgendwo anders auf die Website geklickt wird
        document.addEventListener('click', (event) => {
            if (!searchContainer.contains(event.target)) {
                searchContainer.classList.remove('is-focused');
                searchInput.blur();
            }
        });
    }
});

let audioFiles = [];

const ITEMS_PER_PAGE = 25;
const PROFILE_ITEMS_PER_PAGE = 12;
let currentPage = 1;
let profileCurrentPage = 1;
let currentCategoryFilter = "all";
let currentBeatFilter = "all";
let currentSearchQuery = "";
const beatMetadataCache = new Map();

// Gemerkte zufällige Reihenfolge für die Home-Seite (bleibt während der Session stabil)
let homeRandomOrderCache = null;

const APP_BASE_PATH = "/endlessaudios";
const ASSET_BASE_URL = "https://audios-4mx.pages.dev";
const BEAT_MARKED_LIST_URL = `${ASSET_BASE_URL}/beatmarked`;
const COUNTER_WORKSPACE = "endlessaudios";
const COUNTER_API_KEY = "ut_WkHJV7oNtC3MJl52ubvQcoW6Qhzq85UoJSOpO4Bo";
const TOTAL_COUNTER_NAME = "all-downloads";

// Global volume setting (persists across all tracks)
let globalVolume = parseFloat(localStorage.getItem('globalVolume') || '0.8');
let audioCtx = null;
let gainNode = null;
let currentBuffer = null;
let sourceNode = null;
let currentTrackUrl = null;
let startTime = 0;
let pauseOffset = 0;
let isPlaying = false;
let playbackTimer = null;
let isDraggingSlider = false;
let previousVolume = 1;

const audioListContainer = document.getElementById("audioList");
const searchInput = document.getElementById("searchInput");
const bottomPlayer = document.getElementById("bottomPlayer");
const playerTitle = document.getElementById("playerTitle");
const playerCategory = document.getElementById("playerCategory");
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const seekBar = document.getElementById("seekBar");
const currentTimeEl = document.getElementById("currentTime");
const durationTimeEl = document.getElementById("durationTime");

const mainContentWrapper = document.getElementById("mainContentWrapper");
const creatorsWrapper = document.getElementById("creatorsWrapper");
const profileContainer = document.getElementById("profileContainer");
const paginationContainer = document.getElementById("paginationContainer");
const pageInfo = document.getElementById("pageInfo");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");

let detailContainer = document.getElementById("detailContainer");
if (!detailContainer) {
    detailContainer = document.createElement("div");
    detailContainer.id = "detailContainer";
    detailContainer.style.display = "none";
    detailContainer.className = "library-wrapper";
    if (mainContentWrapper && mainContentWrapper.parentNode) {
        mainContentWrapper.parentNode.insertBefore(detailContainer, mainContentWrapper.nextSibling);
    } else {
        document.body.appendChild(detailContainer);
    }
}

let exploreContainer = document.getElementById("exploreContainer");
if (!exploreContainer) {
    exploreContainer = document.createElement("div");
    exploreContainer.id = "exploreContainer";
    exploreContainer.style.display = "none";
    exploreContainer.className = "library-wrapper";
    if (mainContentWrapper && mainContentWrapper.parentNode) {
        mainContentWrapper.parentNode.insertBefore(exploreContainer, mainContentWrapper.nextSibling);
    } else {
        document.body.appendChild(exploreContainer);
    }
}

let tutorialContainer = document.getElementById("tutorialContainer");
if (!tutorialContainer) {
    tutorialContainer = document.createElement("div");
    tutorialContainer.id = "tutorialContainer";
    tutorialContainer.style.display = "none";
    tutorialContainer.className = "library-wrapper";
    if (mainContentWrapper && mainContentWrapper.parentNode) {
        mainContentWrapper.parentNode.insertBefore(tutorialContainer, exploreContainer.nextSibling);
    } else {
        document.body.appendChild(tutorialContainer);
    }
}

let legalContainer = document.getElementById("legalContainer");
if (!legalContainer) {
    legalContainer = document.createElement("div");
    legalContainer.id = "legalContainer";
    legalContainer.style.display = "none";
    legalContainer.className = "library-wrapper";
    if (mainContentWrapper && mainContentWrapper.parentNode) {
        mainContentWrapper.parentNode.insertBefore(legalContainer, document.querySelector("footer"));
    } else {
        document.body.appendChild(legalContainer);
    }
}

function showToast(message) {
    let existingToast = document.getElementById("siteToast");
    if (existingToast) existingToast.remove();

    const toast = document.createElement("div");
    toast.id = "siteToast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(18, 18, 24, 0.95);
        backdrop-filter: blur(16px);
        border: 1px solid var(--border-hover);
        color: var(--text-main);
        padding: 10px 20px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        z-index: 2000;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    }, 10);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function showBeatMarkedInfo(event) {
    if (event) event.stopPropagation();
    showToast("This audio comes with marked beats if you download and import it into After Effects.");
}

function shareTrack(event, track) {
    if (event) event.stopPropagation();
    if (!track?.filename) return;
    const url = `${window.location.origin}${APP_BASE_PATH}/audio/${encodeURIComponent(track.filename)}`;
    const copyPromise = navigator.clipboard?.writeText(url);
    if (copyPromise) {
        copyPromise.then(() => showToast("Link copied to clipboard!"))
            .catch(() => copyShareUrlFallback(url));
        return;
    }
    copyShareUrlFallback(url);
}

function copyShareUrlFallback(url) {
    const input = document.createElement('textarea');
    input.value = url;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    showToast(copied ? "Link copied to clipboard!" : "Copy the link from your browser address bar.");
}

function decodeId3Text(value) {
    if (!value || value.length === 0) return "";

    let result = "";
    try {
        result = new TextDecoder('utf-8').decode(value);
    } catch (e) {
        result = Array.from(value).map(byte => String.fromCharCode(byte)).join('');
    }

    return result.replace(/\u0000/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseId3FrameString(frameBody) {
    if (!frameBody || frameBody.length === 0) return "";

    if (frameBody[0] === 0x00 && frameBody[1] === 0x00 && frameBody[2] === 0x00 && frameBody[3] === 0x00) {
        return "";
    }

    let offset = 0;
    const encoding = frameBody[0];
    offset += 1;

    if (encoding === 0x01 || encoding === 0x02 || encoding === 0x03) {
        const bytes = frameBody.slice(offset);
        const textBytes = bytes.filter((_, index) => index < bytes.length - 1 || bytes[index] !== 0);
        return decodeId3Text(textBytes);
    }

    return decodeId3Text(frameBody.slice(offset));
}

function readSyncSafeInt(bytes) {
    if (!bytes || bytes.length === 0) return 0;
    let value = 0;
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 7) | (bytes[i] & 0x7f);
    }
    return value;
}

function normalizeMetadataText(value) {
    return String(value || '').replace(/\0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeBeatMarkedPath(value) {
    if (!value) return "";
    return decodeURIComponent(String(value))
        .replace(/\\/g, '/')
        .replace(/^https?:\/\/[^/]+/i, '')
        .replace(/^\/+/, '')
        .trim()
        .toLowerCase();
}

async function hydrateBeatMarkedFlags(tracks) {
    if (!Array.isArray(tracks)) return;

    try {
        const response = await fetch(BEAT_MARKED_LIST_URL, { method: 'GET' });
        if (!response.ok) {
            tracks.forEach(track => { track.beatMarked = false; });
            return;
        }

        const text = await response.text();
        const beatMarkedSet = new Set(
            text
                .split(/\r?\n/)
                .map(line => normalizeBeatMarkedPath(line))
                .filter(Boolean)
        );

        tracks.forEach(track => {
            const fileKey = normalizeBeatMarkedPath(track?.filename);
            track.beatMarked = fileKey ? beatMarkedSet.has(fileKey) : false;
        });
    } catch (error) {
        tracks.forEach(track => { track.beatMarked = false; });
    }
}

async function loadAudios() {
    try {
        const response = await fetch(`${ASSET_BASE_URL}/audios.json`);
        if (response.ok) {
            audioFiles = await response.json();
            if (!Array.isArray(audioFiles)) audioFiles = [];
            updateSearchPlaceholder();
            await hydrateBeatMarkedFlags(audioFiles);
            await loadDownloadCounts(audioFiles);
        } else {
            audioFiles = [];
            updateSearchPlaceholder();
        }
    } catch (e) {
        audioFiles = [];
        updateSearchPlaceholder();
    }

    handleRouting(window.location.pathname, false);
}

window.addEventListener('popstate', () => {
    handleRouting(window.location.pathname, false);
});

function setActiveNavLink(pathname) {
    const navLinks = document.querySelectorAll('.nav-link');
    const cleanPath = pathname.replace(/\/$/, '');

    navLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const label = link.textContent.trim().toLowerCase();
        let isActive = false;

        if (cleanPath === '/' || cleanPath === '') {
            isActive = label === 'home';
        } else if (cleanPath.endsWith('/explore')) {
            isActive = label === 'explore';
        } else if (cleanPath.endsWith('/creators') || cleanPath.includes('/creators/')) {
            isActive = label === 'creators';
        } else if (cleanPath.endsWith('/terms') || cleanPath.endsWith('/privacy')) {
            isActive = false; // Legal pages have no header nav link
        } else {
            isActive = label === 'home';
        }

        link.classList.toggle('active', isActive);
    });
}

function handleRouting(pathname, pushHistory = true) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const cleanPath = pathname.replace(/\/$/, "");
    
    if (cleanPath.startsWith(`${APP_BASE_PATH}/audio/`)) {
        const filename = decodeURIComponent(cleanPath.split(`${APP_BASE_PATH}/audio/`)[1]);
        const track = audioFiles.find(a => a.filename === filename);
        if (pushHistory) history.pushState({ view: 'detail', filename: filename }, '', pathname);
        if (track) {
            renderDetailView(track);
        } else {
            setTimeout(() => {
                const found = audioFiles.find(a => a.filename === filename);
                if (found) renderDetailView(found);
                else renderHomeView();
            }, 500);
        }
    } else if (cleanPath.endsWith('/explore')) {
        if (pushHistory) history.pushState({ view: 'explore' }, '', pathname);
        renderExploreView();
    } else if (cleanPath.endsWith('/creators')) {
        if (pushHistory) history.pushState({ view: 'creators' }, '', pathname);
        renderCreatorsListView();
    } else if (cleanPath.endsWith('/creators/')) {
        const uploaderName = decodeURIComponent(cleanPath.split('/creators/')[1]);
        if (pushHistory) history.pushState({ view: 'profile', uploader: uploaderName }, '', pathname);
        renderProfileView(uploaderName);
    } else if (cleanPath.includes('/creators/')) {
        const uploaderName = decodeURIComponent(cleanPath.split('/creators/')[1]);
        if (pushHistory) history.pushState({ view: 'profile', uploader: uploaderName }, '', pathname);
        renderProfileView(uploaderName);
    } else if (cleanPath.endsWith('/terms')) {
        if (pushHistory) history.pushState({ view: 'terms' }, '', pathname);
        renderTermsView();
    } else if (cleanPath.endsWith('/privacy')) {
        if (pushHistory) history.pushState({ view: 'privacy' }, '', pathname);
        renderPrivacyView();
    } else {
        if (pushHistory) history.pushState({ view: 'home' }, '', pathname);
        renderHomeView();
    }

    setActiveNavLink(cleanPath);
}

function getPreviewAndDownloadUrls(audioData) {
    let fullDownloadUrl = audioData.filename; 
    if (!fullDownloadUrl.startsWith('http')) {
        if (!fullDownloadUrl.startsWith('/')) fullDownloadUrl = '/' + fullDownloadUrl;
        fullDownloadUrl = ASSET_BASE_URL + fullDownloadUrl;
    }

    let fullPreviewUrl = audioData.previewUrl;
    if (!fullPreviewUrl) {
        const parts = audioData.filename.split('/');
        if (parts.length >= 3) {
            const root = parts[0];       
            let sub = parts.slice(1).join('/'); 
            
            sub = sub.replace(/\.[^/.]+$/, ".mp3");
            
            fullPreviewUrl = `${root}-previews/${sub}`;
        } else {
            fullPreviewUrl = audioData.filename.replace(/\.[^/.]+$/, ".mp3");
        }
    }
    
    if (!fullPreviewUrl.startsWith('http')) {
        if (!fullPreviewUrl.startsWith('/')) fullPreviewUrl = '/' + fullPreviewUrl;
        fullPreviewUrl = ASSET_BASE_URL + fullPreviewUrl;
    }

    return { fullPreviewUrl, fullDownloadUrl };
}

function getTrackDownloads(track) {
    return Number(track?.downloads || 0);
}

function getCounterRequestOptions() {
    const headers = {};
    if (COUNTER_API_KEY) headers.Authorization = `Bearer ${COUNTER_API_KEY}`;
    return { cache: "no-store", headers };
}

function updateGlobalDownloadStats(total) {
    const totalElement = document.getElementById("totalDownloadCount");
    if (totalElement) totalElement.textContent = total;
}

function updateSearchPlaceholder() {
    if (searchInput) {
        searchInput.placeholder = `Search ${audioFiles.length} by title, category or uploader...`;
    }
}

async function loadDownloadCounts(tracks) {
    tracks.forEach(track => {
        track.downloads = 0;
    });

    try {
        const totalResponse = await fetch(
            `https://api.counterapi.dev/v2/${COUNTER_WORKSPACE}/${TOTAL_COUNTER_NAME}`,
            getCounterRequestOptions()
        );
        if (!totalResponse.ok) throw new Error("Global counter request failed");
        const totalResult = await totalResponse.json();
        updateGlobalDownloadStats(Number(totalResult.count || 0));
    } catch (error) {
        updateGlobalDownloadStats(0);
    }
}

function showDownloadModal(track) {
    const existingModal = document.getElementById("downloadModalBackdrop");
    if (existingModal) existingModal.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "downloadModalBackdrop";
    backdrop.className = "download-modal-backdrop";

    backdrop.innerHTML = `
        <div class="download-modal-card">
            <button class="download-modal-close" id="closeModalBtn">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <img src="logo.png" alt="Logo" class="download-modal-logo" style="width: 64px; height: 64px; border-radius: 16px; object-fit: cover; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); display: block; margin: 0 auto 15px auto;" onerror="this.style.display='none'">
            
            <div class="download-modal-title">Thanks for supporting us!</div>
            <div class="download-modal-text">
                This audio was provided by EndlessAudios. Feel free to check out our Discord server to connect with others or share your latest edits.
            </div>
            
            <a href="https://discord.gg/2kkGbn5fyz" target="_blank" class="download-modal-btn">
                Open Discord Server
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>
            </a>
            
            <div class="download-modal-footer">
                Your download should start automatically.
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    const closeModal = () => {
        const card = backdrop.querySelector('.download-modal-card');
        backdrop.style.animation = 'backdropFadeIn 0.25s reverse forwards';
        card.style.animation = 'modalFadeIn 0.25s reverse forwards';
        setTimeout(() => backdrop.remove(), 250);
    };

    backdrop.querySelector('#closeModalBtn').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });
}

async function incrementDownload(track, counterElementId) {
    if (!track?.filename) return;

    try {
        const totalResponse = await fetch(
            `https://api.counterapi.dev/v2/${COUNTER_WORKSPACE}/${TOTAL_COUNTER_NAME}/up`,
            getCounterRequestOptions()
        );
        if (!totalResponse.ok) throw new Error("Global counter request failed");

        const totalResult = await totalResponse.json();
        const totalCount = Number(totalResult.count || 0);
        updateGlobalDownloadStats(totalCount);
        track.downloads = totalCount;

        if (counterElementId) {
            document.querySelectorAll(`[id="${counterElementId}"]`).forEach(el => {
                el.textContent = `${totalCount} downloads`;
            });
        }
    } catch (error) {
        console.warn("Download counter unavailable:", error);
    }
}

async function downloadTrack(event, url, track, counterId) {
    if (event) event.stopPropagation();
    
    showDownloadModal(track);

    const filename = track.filename ? track.filename.split('/').pop() : 'download.mp3';
    let alreadyIncremented = false;

    try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        
        const forcedBlob = new Blob([blob], { type: "application/octet-stream" });
        const blobUrl = window.URL.createObjectURL(forcedBlob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
            a.remove();
        }, 100);
        
        if (counterId) {
            await incrementDownload(track, counterId);
            alreadyIncremented = true;
        }
    } catch (err) {
        console.warn("CORS fetch blocked, using invisible iframe download method...", err);
        
        let hiddenIframe = document.getElementById("hiddenDownloadIframe");
        if (!hiddenIframe) {
            hiddenIframe = document.createElement("iframe");
            hiddenIframe.id = "hiddenDownloadIframe";
            hiddenIframe.style.display = "none";
            document.body.appendChild(hiddenIframe);
        }
        
        hiddenIframe.src = url;

        if (counterId && !alreadyIncremented) {
            await incrementDownload(track, counterId);
        }
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function getTrackBeatMarked(track) {
    const beatValue = track?.beatMarked ?? track?.beat_marked ?? track?.beatmarked ?? track?.metadata?.beatMarked ?? track?.meta?.beatMarked ?? false;

    if (typeof beatValue === "string") {
        const normalized = beatValue.trim().toLowerCase();
        return normalized === "true" || normalized === "yes" || normalized === "y" || normalized === "1";
    }

    if (typeof beatValue === "number") {
        return beatValue === 1;
    }

    return Boolean(beatValue);
}

function getFilteredItems() {
    let filtered = audioFiles.filter(a => {
        const title = (a.title || "").toLowerCase();
        let category = (a.category || "").toLowerCase();
        const uploader = (a.uploader || "").toLowerCase();
        const beatMarked = getTrackBeatMarked(a);

        if (category.startsWith("community")) {
            category = "community";
        }

        const matchesSearch = title.includes(currentSearchQuery) || 
                              category.includes(currentSearchQuery) ||
                              uploader.includes(currentSearchQuery);
                              
        let matchesCategory = currentCategoryFilter === "all" || category === currentCategoryFilter.toLowerCase();
        if (currentCategoryFilter.toLowerCase() === "community") {
            matchesCategory = category.startsWith("community");
        }

        let matchesBeat = true;
        if (currentBeatFilter === "yes") {
            matchesBeat = beatMarked;
        } else if (currentBeatFilter === "no") {
            matchesBeat = !beatMarked;
        }

        return matchesSearch && matchesCategory && matchesBeat;
    });

    if (currentSearchQuery.trim() !== "") {
        // Suchergebnisse bleiben nach Downloads sortiert
        filtered.sort((a, b) => getTrackDownloads(b) - getTrackDownloads(a));
    } else {
        // Startseite: Zufällige Reihenfolge (stabil während der Session gesichert)
        if (!homeRandomOrderCache) {
            homeRandomOrderCache = [...audioFiles].sort(() => Math.random() - 0.5);
        }
        // Filtert die Elemente basierend auf der einmalig gemischten Home-Reihenfolge
        filtered.sort((a, b) => {
            return homeRandomOrderCache.indexOf(a) - homeRandomOrderCache.indexOf(b);
        });
    }

    return filtered;
}

if (searchInput) {
    const searchClearBtn = document.getElementById("searchClearBtn");

    const updateSearchClearButton = () => {
        if (!searchClearBtn) return;
        const hasValue = searchInput.value.trim() !== "";
        searchClearBtn.classList.toggle("visible", hasValue);
    };

    searchInput.addEventListener("input", (e) => {
        currentSearchQuery = e.target.value.toLowerCase();
        currentCategoryFilter = "all";
        document.querySelectorAll('.filter-tab[data-category]').forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-category") === "all");
        });
        currentPage = 1;
        updateSearchClearButton();
        renderApp();
    });

    searchClearBtn?.addEventListener("click", () => {
        searchInput.value = "";
        currentSearchQuery = "";
        currentCategoryFilter = "all";
        document.querySelectorAll('.filter-tab[data-category]').forEach(tab => {
            tab.classList.toggle("active", tab.getAttribute("data-category") === "all");
        });
        currentPage = 1;
        updateSearchClearButton();
        renderApp();
        searchInput.focus();
    });

    updateSearchClearButton();
}

document.querySelectorAll(".filter-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
        const currentTab = e.target;
        const tabCategory = currentTab.getAttribute("data-category");
        const beatFilter = currentTab.getAttribute("data-beat-filter");

        if (tabCategory !== null) {
            currentCategoryFilter = currentCategoryFilter === tabCategory ? "all" : tabCategory;
        }

        if (beatFilter !== null) {
            currentBeatFilter = currentBeatFilter === beatFilter ? "all" : beatFilter;
        }

        document.querySelectorAll(".filter-tab").forEach(t => {
            const categoryValue = t.getAttribute("data-category");
            const beatValue = t.getAttribute("data-beat-filter");
            const isCategoryActive = categoryValue !== null && currentCategoryFilter === categoryValue;
            const isBeatActive = beatValue !== null && currentBeatFilter === beatValue;
            t.classList.toggle("active", isCategoryActive || isBeatActive);
        });

        currentPage = 1;
        renderApp();
    });
});

function changePage(direction) {
    currentPage += direction;
    renderApp();
}

function renderApp() {
    const filteredItems = getFilteredItems();
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const paginatedItems = filteredItems.slice(start, end);
    audioListContainer.innerHTML = "";
    
    if(paginatedItems.length === 0) {
        audioListContainer.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 14px;">No audios found.</div>`;
        paginationContainer.style.display = "none";
        return;
    }
    
    paginatedItems.forEach((audioData, index) => {
        const row = document.createElement("div");
        row.className = "audio-row";
        const { fullPreviewUrl, fullDownloadUrl } = getPreviewAndDownloadUrls(audioData);
        const fileExtension = audioData.filename ? audioData.filename.split('.').pop().toLowerCase() : 'mp3';
        const downloadCount = getTrackDownloads(audioData);
        const counterId = `dl-count-main-${index}`;
        const safeTitle = (audioData.title || "").replace(/'/g, "\\'");
        const beatMarked = getTrackBeatMarked(audioData);
        
        let displayCategory = audioData.category || "";
        if (displayCategory.toLowerCase().startsWith("community")) {
            displayCategory = "COMMUNITY";
        }
        
        const beatTagMarkup = beatMarked
            ? `<span class="tag beat-tag beat-yes" onclick="event.stopPropagation(); showBeatMarkedInfo(event);">MARKED</span>`
            : "";
        
        row.innerHTML = `
            <div class="track-left">
                <div class="track-cover"><svg width="14" height="14" fill="#ffffff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                <div class="track-details">
                    <div class="title">${audioData.title}</div>
                    <div class="meta">${fileExtension} · by ${audioData.uploader}</div>
                </div>
            </div>
            <div class="tag-group">
                <span class="tag uploader" onclick="event.stopPropagation(); showUploaderProfile('${audioData.uploader}')">@${audioData.uploader}</span>
                <span class="tag">${displayCategory}</span>
                ${beatTagMarkup}
            </div>
            <div class="download-info-group" style="display: flex; align-items: center; gap: 10px;">
                <button title="Share" onclick="shareTrack(event, audioFiles.find(x => x.filename === '${audioData.filename}'))" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); cursor:pointer; display:flex; align-items:center; justify-content:center; width: 32px; height: 32px; border-radius: 8px; transition: all 0.2s;">
                    <svg width="15" height="15" fill="none" stroke="var(--text-muted)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
                <span class="download-counter" id="${counterId}">${downloadCount} downloads</span>
                <button class="download-action" onclick="downloadTrack(event, '${fullDownloadUrl}', audioFiles.find(x => x.filename === '${audioData.filename}' || x.title === '${safeTitle}'), '${counterId}')">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                </button>
            </div>
        `;
        row.addEventListener("click", () => playTrack(audioData, fullPreviewUrl));
        audioListContainer.appendChild(row);
    });
    
    paginationContainer.style.display = filteredItems.length > ITEMS_PER_PAGE ? "flex" : "none";
    if (filteredItems.length > ITEMS_PER_PAGE) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }
}

async function playTrack(track, previewUrl) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    
    if (!gainNode) {
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.value = globalVolume;
    }
    
    const originalContent = playIcon.innerHTML;
    playIcon.innerHTML = '<div class="spinner"></div>';
    playPauseBtn.disabled = true;

    stopCurrentSource();
    
    let catText = track.category || "";
    if (catText.toLowerCase().startsWith("community")) catText = "COMMUNITY";

    playerTitle.textContent = track.title;
    playerCategory.textContent = `${catText.toUpperCase()} • BY ${track.uploader.toUpperCase()}`;
    bottomPlayer.classList.add("active");

    updateBottomPlayerExtraButtons(track);

    const playerInfoEl = document.querySelector('.player-info');
    if (playerInfoEl) {
        playerInfoEl.classList.remove('animate');
        void playerInfoEl.offsetWidth;
        playerInfoEl.classList.add('animate');
    }

    if (currentTrackUrl === previewUrl && currentBuffer) {
        playPauseBtn.disabled = false;
        updatePlayButton();
        startBufferPlayback(0);
        return;
    }

    currentTrackUrl = previewUrl;
    pauseOffset = 0;

    try {
        const response = await fetch(previewUrl);
        if (!response.ok) throw new Error("Audio resource not found");
        
        const arrayBuffer = await response.arrayBuffer();
        currentBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        if (currentTrackUrl === previewUrl) {
            playPauseBtn.disabled = false;
            updatePlayButton();
            startBufferPlayback(0);
        }
    } catch (err) {
        console.error("Audio loading error:", err);
        playerTitle.textContent = "Error loading audio";
        playIcon.innerHTML = originalContent;
        playPauseBtn.disabled = false;
    }
}

function updateBottomPlayerExtraButtons(track) {
    const topRow = bottomPlayer.querySelector('.player-top-row');
    if (topRow) {
        topRow.style.display = "grid";
        topRow.style.gridTemplateColumns = "1fr auto 1fr";
        topRow.style.alignItems = "center";
        
        const controlsCenter = topRow.querySelector('.player-controls-center');
        if (controlsCenter) {
            controlsCenter.style.display = "flex";
            controlsCenter.style.justifyContent = "center";
        }
    }

    let extraContainer = document.getElementById("bottomPlayerExtras");
    if (!extraContainer) {
        extraContainer = document.createElement("div");
        extraContainer.id = "bottomPlayerExtras";
        extraContainer.style.display = "flex";
        extraContainer.style.alignItems = "center";
        extraContainer.style.justifyContent = "flex-end";
        extraContainer.style.gap = "8px";
        
        if (topRow && !topRow.contains(extraContainer)) {
            topRow.appendChild(extraContainer);
        }
    }
    
    const { fullDownloadUrl } = getPreviewAndDownloadUrls(track);
    const playerCounterId = `dl-count-player-${track.filename.replace(/[^a-z0-9]/gi, '_')}`;
    extraContainer.innerHTML = `
        <button title="Share" onclick="shareTrack(event, audioFiles.find(x => x.filename === '${track.filename}'))" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); cursor:pointer; display:flex; align-items:center; justify-content:center; width: 32px; height: 32px; border-radius: 8px; transition: all 0.2s;">
            <svg width="15" height="15" fill="none" stroke="var(--text-muted)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
        </button>
        <button title="Download" onclick="downloadTrack(event, '${fullDownloadUrl}', audioFiles.find(x => x.filename === '${track.filename}'), '${playerCounterId}')" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); cursor:pointer; display:flex; align-items:center; justify-content:center; width: 32px; height: 32px; border-radius: 8px; transition: all 0.2s;">
            <svg width="15" height="15" fill="none" stroke="var(--text-muted)" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <span id="${playerCounterId}" style="display:none">${getTrackDownloads(track)} downloads</span>
    `;
    
    let volContainer = document.getElementById("volumeContainer");
    if (!volContainer) {
        volContainer = document.createElement("div");
        volContainer.id = "volumeContainer";
        volContainer.style.display = "flex";
        volContainer.style.alignItems = "center";
        volContainer.style.gap = "6px";
        volContainer.style.marginLeft = "10px";
        volContainer.innerHTML = `
            <span id="volumeIconBtn" style="font-size:14px; color:var(--text-muted); display:flex; align-items:center; cursor:pointer;" title="Mute/Unmute">
                <svg id="volumeIconSvg" width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
            </span>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.05" value="${globalVolume}" style="width: 60px; cursor: pointer; accent-color: var(--accent-glow);">
        `;
        
        extraContainer.appendChild(volContainer);
        
        const volSlider = document.getElementById("volumeSlider");
        const volumeIconBtn = document.getElementById("volumeIconBtn");
        
        volSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            globalVolume = val;
            localStorage.setItem('globalVolume', val);
            if (gainNode) gainNode.gain.value = val;
            updateVolumeIcon(val);
        });

        volumeIconBtn.addEventListener("click", () => {
            if (!gainNode) return;
            if (gainNode.gain.value > 0) {
                previousVolume = gainNode.gain.value;
                gainNode.gain.value = 0;
                volSlider.value = 0;
                updateVolumeIcon(0);
            } else {
                const restoreVol = previousVolume > 0 ? previousVolume : globalVolume;
                gainNode.gain.value = restoreVol;
                volSlider.value = restoreVol;
                localStorage.setItem('globalVolume', restoreVol);
                updateVolumeIcon(restoreVol);
            }
        });
    }
}

function updateVolumeIcon(volume) {
    const iconSvg = document.getElementById("volumeIconSvg");
    if (!iconSvg) return;

    if (volume === 0) {
        iconSvg.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
    } else {
        iconSvg.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
    }
}

function startBufferPlayback(offsetSeconds) {
    if (!currentBuffer) return;
    stopCurrentSource();
    
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = currentBuffer;
    sourceNode.connect(gainNode);
    
    sourceNode.start(0, offsetSeconds);
    startTime = audioCtx.currentTime - offsetSeconds;
    isPlaying = true;
    updatePlayButton();
    
    sourceNode.onended = () => {
        if (isPlaying && getCurrentPlaybackTime() >= currentBuffer.duration - 0.1) {
            isPlaying = false;
            updatePlayButton();
            pauseOffset = 0;
            seekBar.value = 0;
        }
    };
    
    startProgressTracker();
}

function stopCurrentSource() {
    if (sourceNode) {
        try { 
            sourceNode.onended = null;
            sourceNode.stop(); 
            sourceNode.disconnect(); 
        } catch (e) {}
        sourceNode = null;
    }
    stopProgressTracker();
}

function getCurrentPlaybackTime() {
    if (!currentBuffer) return 0;
    if (isPlaying) {
        let current = audioCtx.currentTime - startTime;
        if (current > currentBuffer.duration) return currentBuffer.duration;
        return current;
    }
    return pauseOffset;
}

function startProgressTracker() {
    stopProgressTracker();
    playbackTimer = setInterval(() => {
        if (!isPlaying || !currentBuffer || isDraggingSlider) return;
        const currentPos = getCurrentPlaybackTime();
        const duration = currentBuffer.duration;
        const percentage = (currentPos / duration) * 100;
        
        currentTimeEl.textContent = formatTime(currentPos);
        durationTimeEl.textContent = formatTime(duration);
        seekBar.value = percentage;
        seekBar.style.setProperty('--value', percentage + '%');
    }, 50);
}

function stopProgressTracker() {
    if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; }
}

function updatePlayButton() {
    playIcon.innerHTML = isPlaying ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' : '<path d="M8 5v14l11-7z"/>';
}

playPauseBtn.addEventListener("click", () => {
    if (!currentBuffer) return;
    if (isPlaying) {
        pauseOffset = getCurrentPlaybackTime();
        stopCurrentSource();
        isPlaying = false;
    } else {
        if (pauseOffset >= currentBuffer.duration) pauseOffset = 0;
        startBufferPlayback(pauseOffset);
    }
    updatePlayButton();
});

seekBar.addEventListener("mousedown", () => { isDraggingSlider = true; });
seekBar.addEventListener("touchstart", () => { isDraggingSlider = true; });

seekBar.addEventListener("input", () => {
    if (!currentBuffer) return;
    const targetTime = (seekBar.value / 100) * currentBuffer.duration;
    currentTimeEl.textContent = formatTime(targetTime);
    durationTimeEl.textContent = formatTime(currentBuffer.duration);
    seekBar.style.setProperty('--value', seekBar.value + '%');
    pauseOffset = targetTime;
});

seekBar.addEventListener("mouseup", () => {
    isDraggingSlider = false;
    if (!currentBuffer) return;
    const targetTime = (seekBar.value / 100) * currentBuffer.duration;
    seekBar.style.setProperty('--value', seekBar.value + '%');
    pauseOffset = targetTime;
    if (isPlaying) {
        startBufferPlayback(targetTime);
    }
});

seekBar.addEventListener("touchend", () => {
    isDraggingSlider = false;
    if (!currentBuffer) return;
    const targetTime = (seekBar.value / 100) * currentBuffer.duration;
    seekBar.style.setProperty('--value', seekBar.value + '%');
    pauseOffset = targetTime;
    if (isPlaying) {
        startBufferPlayback(targetTime);
    }
});

function showExplore() {
    handleRouting(`${APP_BASE_PATH}/explore`, true);
}

function renderExploreView() {
    mainContentWrapper.style.display = "none";
    creatorsWrapper.style.display = "none";
    profileContainer.style.display = "none";
    detailContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    if (typeof legalContainer !== 'undefined') legalContainer.style.display = "none";
    exploreContainer.style.display = "block";

    let allTimeList = [...audioFiles].sort((a, b) => getTrackDownloads(b) - getTrackDownloads(a)).slice(0, 5);
    exploreContainer.innerHTML = `
        <div class="library-box" style="margin-top: 30px;">
            <section class="hero" style="padding: 40px 20px 20px 20px;">
                <h1>Explore</h1>
                <p style="color: #9898a6; font-size: 1.1rem; margin-top: 10px;">Need some fresh ideas? - Explore the most trending audios right now</p>
            </section>
            <div style="margin-bottom: 35px;">

            <div style="background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(6, 182, 212, 0.08)); border: 1px solid var(--border-hover); border-radius: 20px; padding: 30px; margin-bottom: 40px; text-align: center;">
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Need Editing Inspiration?</h2>
                <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Let our randomizer pick 3 unique audio assets for your current project.</p>
                <button onclick="triggerInspoRandomizer()" style="background: linear-gradient(135deg, var(--accent-glow), var(--accent-cyan)); color: #fff; border: none; padding: 12px 28px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                    🎲 Roll 3 Random Tracks
                </button>
                <div id="inspoResultsContainer" style="margin-top: 25px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; text-align: left;"></div>
            </div>

            <div>
                <div>
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                        🔥 Most Downloaded (All Time)
                    </h3>
                    <div id="allTimeChartList" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>
            </div>

            <div style="margin-top: 35px;">
                <button onclick="showHome()" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">← Back to library</button>
            </div>
        </div>
    `;

    renderChartList("allTimeChartList", allTimeList);
}

function renderChartList(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    if (list.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px; padding: 15px;">No stats available yet.</div>`;
        return;
    }

    list.forEach((track, index) => {
        const { fullPreviewUrl, fullDownloadUrl } = getPreviewAndDownloadUrls(track);
        const item = document.createElement("div");
        item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        item.onmouseover = () => item.style.background = "rgba(255, 255, 255, 0.05)";
        item.onmouseout = () => item.style.background = "rgba(255, 255, 255, 0.02)";
        item.onclick = () => playTrack(track, fullPreviewUrl);

        const count = getTrackDownloads(track);

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden;">
                <span style="font-size: 13px; font-weight: 700; color: var(--text-muted); width: 14px;">#${index + 1}</span>
                <div style="overflow: hidden;">
                    <div style="font-size: 13px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">@${track.uploader}</div>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--accent-cyan); font-weight: 600; white-space: nowrap; margin-left: 10px;">${count} DLs</div>
        `;
        container.appendChild(item);
    });
}

function triggerInspoRandomizer() {
    const container = document.getElementById("inspoResultsContainer");
    if (!container || audioFiles.length === 0) return;

    let shuffled = [...audioFiles].sort(() => 0.5 - Math.random());
    let selected = shuffled.slice(0, 3);

    container.innerHTML = "";
    selected.forEach(track => {
        const { fullPreviewUrl, fullDownloadUrl } = getPreviewAndDownloadUrls(track);
        const counterId = `dl-count-inspo-${track.filename.replace(/[^a-z0-9]/gi, '_')}`;
        const card = document.createElement("div");
        card.style.cssText = `
            background: rgba(18, 18, 24, 0.8);
            border: 1px solid var(--border-hover);
            border-radius: 12px;
            padding: 15px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 10px;
        `;
        card.innerHTML = `
            <div>
                <div style="font-size: 10px; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">${track.category || 'Audio'}</div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">${track.title}</div>
                <div id="${counterId}" style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">${getTrackDownloads(track)} downloads</div>
                <div style="font-size: 11px; color: var(--text-muted);">by @${track.uploader}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="playTrack(audioFiles.find(x => x.filename === '${track.filename}'), '${fullPreviewUrl}')" style="flex: 1; background: var(--accent-glow); color: #fff; border: none; padding: 6px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer;">Play</button>
                <button onclick="downloadTrack(event, '${fullDownloadUrl}', audioFiles.find(x => x.filename === '${track.filename}'), '${counterId}')" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); color: var(--text-main); padding: 6px 10px; border-radius: 8px; font-size: 11px; cursor: pointer;">↓</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderDetailView(track) {
    mainContentWrapper.style.display = "none";
    creatorsWrapper.style.display = "none";
    profileContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    if (typeof legalContainer !== 'undefined') legalContainer.style.display = "none";
    detailContainer.style.display = "block";

    const { fullPreviewUrl, fullDownloadUrl } = getPreviewAndDownloadUrls(track);
    let displayCategory = track.category || "Audio";
    if (displayCategory.toLowerCase().startsWith("community")) displayCategory = "COMMUNITY";

    detailContainer.innerHTML = `
        <div class="library-box" style="margin-top: 30px;">
            <div style="display: flex; gap: 30px; align-items: center; flex-wrap: wrap;">
                <div class="track-cover" style="width: 130px; height: 130px; border-radius: 16px; cursor: pointer; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(6, 182, 212, 0.2)); border: 1px solid var(--border-hover);" onclick="playTrack(audioFiles.find(x => x.filename === '${track.filename}'), '${fullPreviewUrl}')">
                    <svg width="36" height="36" fill="var(--text-main)" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div style="flex-grow: 1; min-width: 240px;">
                    <div style="font-size: 11px; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 8px;">AUDIO · ${displayCategory.toUpperCase()}</div>
                    <h1 style="font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 6px; background: linear-gradient(180deg, #fff 60%, var(--text-muted)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${track.title}</h1>
                    <div style="color: var(--text-muted); font-size: 14px; margin-bottom: 20px;">by <span style="color: var(--accent-cyan); cursor: pointer;" onclick="showUploaderProfile('${track.uploader}')">@${track.uploader}</span></div>
                    
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <button class="download-action" style="background: linear-gradient(135deg, var(--accent-glow), var(--accent-cyan)); color: #fff; border-color: transparent;" onclick="downloadTrack(event, '${fullDownloadUrl}', audioFiles.find(x => x.filename === '${track.filename}'), 'dl-count-detail')">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                        </button>
                        <span class="download-counter" id="dl-count-detail">${getTrackDownloads(track)} downloads</span>
                        <button class="download-action" onclick="shareTrack(event, audioFiles.find(x => x.filename === '${track.filename}'))">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            Share
                        </button>
                    </div>
                </div>
            </div>

            <div style="margin-top: 45px; padding: 30px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Explore the full library</div>
                    <div style="font-size: 13px; color: var(--text-muted);">Discover more professional audio assets crafted for editors.</div>
                </div>
                <button onclick="showHome()" style="background: linear-gradient(135deg, var(--accent-glow), var(--accent-cyan)); color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    Listen to all audios here ↗
                </button>
            </div>
            
            <div style="margin-top: 25px;">
                <button onclick="showHome()" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">← Back to library</button>
            </div>
        </div>
    `;
}

function showHome() {
    handleRouting(`${APP_BASE_PATH}/`, true);
}



function showCreatorsList() {
    handleRouting(`${APP_BASE_PATH}/creators`, true);
}

function showTerms() {
    handleRouting(`${APP_BASE_PATH}/terms`, true);
}

function showPrivacy() {
    handleRouting(`${APP_BASE_PATH}/privacy`, true);
}

function showUploaderProfile(uploaderName) {
    handleRouting(`${APP_BASE_PATH}/creators/${encodeURIComponent(uploaderName)}`, true);
}

function renderHomeView() {
    detailContainer.style.display = "none";
    creatorsWrapper.style.display = "none";
    profileContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    if (typeof legalContainer !== 'undefined') legalContainer.style.display = "none";
    mainContentWrapper.style.display = "block";
    renderApp();
}



function renderCreatorsListView() {
    mainContentWrapper.style.display = "none";
    profileContainer.style.display = "none";
    detailContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    if (typeof legalContainer !== 'undefined') legalContainer.style.display = "none";
    creatorsWrapper.style.display = "block";
    const grid = document.getElementById("creatorsGrid");
    grid.innerHTML = "";
    const uploaders = {};
    
    audioFiles.forEach(a => {
        if (!uploaders[a.uploader]) uploaders[a.uploader] = { tracks: [], avatar: a.discordAvatar || null };
        uploaders[a.uploader].tracks.push(a);
    });

    const sortedUploaders = Object.keys(uploaders).sort((a, b) => {
        return uploaders[b].tracks.length - uploaders[a].tracks.length;
    });

    sortedUploaders.forEach(u => {
        const totalDl = uploaders[u].tracks.reduce((sum, t) => sum + getTrackDownloads(t), 0);
        const card = document.createElement("div");
        card.className = "creator-card";
        card.onclick = () => showUploaderProfile(u);
        card.innerHTML = `<div class="creator-banner"><div class="creator-avatar-container">${uploaders[u].avatar ? `<img src="${uploaders[u].avatar}">` : `<div class="avatar-fallback">${u[0]}</div>`}</div></div><div class="creator-info"><div class="creator-card-name">${u}</div><div class="creator-card-stats">${uploaders[u].tracks.length} audios · ${totalDl} downloads</div></div>`;
        grid.appendChild(card);
    });
}

function renderProfileView(uploaderName) {
    mainContentWrapper.style.display = "none";
    creatorsWrapper.style.display = "none";
    detailContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    if (typeof legalContainer !== 'undefined') legalContainer.style.display = "none";
    profileContainer.style.display = "block";
    
    document.getElementById("profileName").textContent = uploaderName;
    
    const profileNameEl = document.getElementById("profileName");
    const avatarContainer = document.getElementById("profileAvatarLarge");
    if (profileNameEl && avatarContainer) {
        avatarContainer.style.position = "relative";
        avatarContainer.style.display = "inline-block";
        profileNameEl.style.display = "inline-block";
        profileNameEl.style.marginLeft = "20px";
        profileNameEl.style.verticalAlign = "middle";
    }

    let uploaderTracks = audioFiles.filter(a => a.uploader.toLowerCase() === uploaderName.toLowerCase());
    uploaderTracks.sort((a, b) => getTrackDownloads(b) - getTrackDownloads(a));

    const totalUploads = uploaderTracks.length;
    const totalDownloads = uploaderTracks.reduce((sum, t) => sum + getTrackDownloads(t), 0);
    
    const categoryCounts = {};
    uploaderTracks.forEach(t => {
        if (t.category) {
            let cat = t.category;
            if (cat.toLowerCase().startsWith("community")) cat = "community";
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
    });
    let mainCategory = "-";
    let maxCount = 0;
    for (const cat in categoryCounts) {
        if (categoryCounts[cat] > maxCount) {
            maxCount = categoryCounts[cat];
            mainCategory = cat;
        }
    }
    if (mainCategory !== "-") {
        mainCategory = mainCategory.charAt(0).toUpperCase() + mainCategory.slice(1);
    }

    const avatarUrl = uploaderTracks.length > 0 ? uploaderTracks[0].discordAvatar : null;
    if (avatarContainer) {
        avatarContainer.innerHTML = "";
        avatarContainer.style.display = "flex";
        avatarContainer.style.alignItems = "center";
        avatarContainer.style.justifyContent = "center";
        avatarContainer.style.fontSize = "30px";
        avatarContainer.style.lineHeight = "1";
        avatarContainer.style.letterSpacing = "0.04em";
        if (avatarUrl) {
            avatarContainer.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
        } else {
            avatarContainer.textContent = uploaderName[0].toUpperCase();
        }
    }

    document.getElementById("statUploads").textContent = totalUploads;
    document.getElementById("statDownloads").textContent = totalDownloads;
    document.getElementById("statCategory").textContent = mainCategory;

    const list = document.getElementById("profileAudioList");
    const profilePrevBtn = document.getElementById("profilePrevPageBtn");
    const profileNextBtn = document.getElementById("profileNextPageBtn");
    const profilePageInfo = document.getElementById("profilePageInfo");
    const profilePagination = document.getElementById("profilePagination");
    list.innerHTML = "";

    const totalProfilePages = Math.ceil(uploaderTracks.length / PROFILE_ITEMS_PER_PAGE) || 1;
    if (profileCurrentPage > totalProfilePages) profileCurrentPage = totalProfilePages;
    if (profileCurrentPage < 1) profileCurrentPage = 1;

    const start = (profileCurrentPage - 1) * PROFILE_ITEMS_PER_PAGE;
    const end = start + PROFILE_ITEMS_PER_PAGE;
    const currentTracks = uploaderTracks.slice(start, end);

    currentTracks.forEach((audioData, index) => {
        const row = document.createElement("div");
        row.className = "audio-row";
        const { fullPreviewUrl, fullDownloadUrl } = getPreviewAndDownloadUrls(audioData);
        const fileExtension = audioData.filename ? audioData.filename.split('.').pop().toLowerCase() : 'mp3';
        const downloadCount = getTrackDownloads(audioData);
        const counterId = `dl-count-profile-${start + index}`;
        const safeTitle = (audioData.title || "").replace(/'/g, "\\'");
        
        let displayCategory = audioData.category || "";
        if (displayCategory.toLowerCase().startsWith("community")) {
            displayCategory = "COMMUNITY";
        }
        
        row.innerHTML = `
            <div class="track-left">
                <div class="track-cover"><svg width="14" height="14" fill="#ffffff" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                <div class="track-details">
                    <div class="title">${audioData.title}</div>
                    <div class="meta">${fileExtension} · by ${audioData.uploader}</div>
                </div>
            </div>
            <div class="tag-group">
                <span class="tag uploader">@${audioData.uploader}</span>
                <span class="tag">${displayCategory}</span>
            </div>
            <div class="download-info-group" style="display: flex; align-items: center; gap: 10px;">
                <button title="Share" onclick="shareTrack(event, audioFiles.find(x => x.filename === '${audioData.filename}'))" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); cursor:pointer; display:flex; align-items:center; justify-content:center; width: 32px; height: 32px; border-radius: 8px;">
                    <svg width="15" height="15" fill="none" stroke="var(--text-muted)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
                <span class="download-counter" id="${counterId}">${downloadCount} downloads</span>
                <button class="download-action" onclick="downloadTrack(event, '${fullDownloadUrl}', audioFiles.find(x => x.filename === '${audioData.filename}' || x.title === '${safeTitle}'), '${counterId}')">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                </button>
            </div>
        `;
        row.addEventListener("click", () => playTrack(audioData, fullPreviewUrl));
        list.appendChild(row);
    });

    if (profilePagination) {
        profilePagination.style.display = uploaderTracks.length > PROFILE_ITEMS_PER_PAGE ? 'flex' : 'none';
    }
    if (profilePageInfo) profilePageInfo.textContent = `Page ${profileCurrentPage} of ${totalProfilePages}`;
    if (profilePrevBtn) profilePrevBtn.disabled = profileCurrentPage === 1;
    if (profileNextBtn) profileNextBtn.disabled = profileCurrentPage === totalProfilePages;

    if (profilePrevBtn) {
        profilePrevBtn.onclick = () => {
            if (profileCurrentPage > 1) {
                profileCurrentPage -= 1;
                renderProfileView(uploaderName);
            }
        };
    }
    if (profileNextBtn) {
        profileNextBtn.onclick = () => {
            if (profileCurrentPage < totalProfilePages) {
                profileCurrentPage += 1;
                renderProfileView(uploaderName);
            }
        };
    }
}

function renderTermsView() {
    mainContentWrapper.style.display = "none";
    creatorsWrapper.style.display = "none";
    profileContainer.style.display = "none";
    detailContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    legalContainer.style.display = "block";

    legalContainer.innerHTML = `
        <div class="library-box" style="margin-top: 30px;">
            <section class="page-hero" style="padding: 24px 20px 12px 20px;">
                <h1>Terms of Service</h1>
                <p>Last updated: September 2, 2026</p>
            </section>
            <div class="legal-content">
                <div class="legal-section">
                    <h2>1. Library access & usage rights</h2>
                    <p>EndlessAudios is a community-driven platform. Access to browse, preview, and download audio assets is free for all users. You may use downloaded audio files in your own projects, whether for personal or commercial purposes. While attribution to creators isn't mandatory, recognizing their work strengthens our community.</p>
                    <h3>Prohibited activities:</h3>
                    <ul>
                        <li>Redistributing, republishing, or commercial reselling of our library or sections of it as a standalone product or service.</li>
                        <li>Automated downloading, scraping, or mass collection of files or metadata without permission.</li>
                        <li>Misrepresenting authorship or falsely claiming ownership of community uploads.</li>
                        <li>Using the platform for illegal activities or purposes that violate applicable laws.</li>
                    </ul>
                </div>

                <div class="legal-section">
                    <h2>2. Content ownership & licensing</h2>
                    <p>Community members contribute audio content to EndlessAudios. We do not claim ownership of the underlying musical compositions, sound recordings, or intellectual property in these files. <strong>We do not provide music licenses</strong> — you are solely responsible for ensuring your use of any audio complies with copyright laws, platform terms (YouTube, TikTok, etc.), and other applicable regulations. Content is offered on an as-is basis.</p>
                </div>

                <div class="legal-section">
                    <h2>3. User accounts & conduct</h2>
                    <p>Accounts are created via Discord login. You are responsible for all activity on your account. Impersonation, credential sharing, or terms violations may result in temporary suspension or permanent account termination, preventing uploads and immediate logout. We reserve the right to enforce this without advance notice.</p>
                </div>

                <div class="legal-section">
                    <h2>4. Uploading content</h2>
                    <p>When you upload audio to EndlessAudios, you represent that you own or have rights to the content. You retain ownership but grant EndlessAudios a worldwide, royalty-free license to store, host, display, and distribute the file—including generating previews and allowing community downloads. Your profile and uploaded works are publicly visible. <strong>All uploads are permanent and public.</strong></p>
                    <h3>Upload restrictions:</h3>
                    <ul>
                        <li>Content you don't have legal rights to distribute.</li>
                        <li>Material that infringes copyrights, trademarks, or other intellectual property.</li>
                        <li>Unlawful, defamatory, hateful, misleading, or malicious content.</li>
                        <li>Duplicates or spam (we use automated fingerprinting to detect resubmissions).</li>
                    </ul>
                    <p>We will remove violating content and may suspend or ban the associated account.</p>
                </div>

                <div class="legal-section">
                    <h2>5. Copyright infringement notices</h2>
                    <p>If you believe your intellectual property has been infringed, please reach out to us on Discord (<a href="https://discord.gg/2kkGbn5fyz" target="_blank">discord.gg/2kkGbn5fyz</a>) with specific references to the content in question. We will investigate and remove flagged material as appropriate.</p>
                </div>

                <div class="legal-section">
                    <h2>6. Creator recognition & status</h2>
                    <p>Verifications, badges, and creator titles are cosmetic designations granted at our discretion. These statuses do not imply ownership, financial benefit, or any legal guarantee and may be modified or revoked at any time.</p>
                </div>

                <div class="legal-section">
                    <h2>7. Service disclaimer & liability</h2>
                    <p>The EndlessAudios platform and all content are provided as-is without warranties. We disclaim responsibility for damages, losses, or issues resulting from your use of the service, downloaded files, or third-party content. Your use is at your own risk.</p>
                </div>

                <div class="legal-section">
                    <h2>8. Service modifications</h2>
                    <p>We may modify, suspend, or discontinue features or the entire service without obligation. These terms may be updated at any time; changes are effective upon posting. Continued use constitutes acceptance of updated terms. We may restrict accounts that violate policies.</p>
                </div>

                <div class="legal-section">
                    <h2>9. Questions & support</h2>
                    <p>For account issues, takedown requests, or questions about these terms, contact us via Discord: <a href="https://discord.gg/2kkGbn5fyz" target="_blank">discord.gg/2kkGbn5fyz</a>.</p>
                </div>

                <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid var(--border-color);">
                    <button onclick="showHome()" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">← Back to library</button>
                </div>
            </div>
        </div>
    `;
}

function renderPrivacyView() {
    mainContentWrapper.style.display = "none";
    creatorsWrapper.style.display = "none";
    profileContainer.style.display = "none";
    detailContainer.style.display = "none";
    exploreContainer.style.display = "none";
    if (typeof tutorialContainer !== 'undefined') tutorialContainer.style.display = "none";
    legalContainer.style.display = "block";

    legalContainer.innerHTML = `
        <div class="library-box" style="margin-top: 30px;">
            <section class="page-hero" style="padding: 24px 20px 12px 20px;">
                <h1>Privacy Policy</h1>
                <p>Last updated: August 14, 2026</p>
            </section>
            <div class="legal-content">
                <div style="background: rgba(139, 92, 246, 0.08); border: 1px solid var(--border-color); border-radius: 14px; padding: 20px; margin-bottom: 30px;">
                    <p style="color: var(--text-main); font-weight: 600; margin: 0;"><strong>Summary:</strong> Browsing and downloading are anonymous—no account required. We don't track you with ads or sell your data. If you create an account, we store minimal information needed to manage your profile and favorites. No tracking, no ads, no selling.</p>
                </div>

                <div class="legal-section">
                    <h2>1. Public browsing (no login required)</h2>
                    <p>Visiting endlessaudios.com and downloading audios don't require registration. Our servers record standard request logs for infrastructure and security purposes: your IP, timestamp, browser type, and requested resource. These logs help us prevent abuse and diagnose issues. Logs are automatically purged after approximately 14 days. We don't use this data for marketing, analytics, or user profiling.</p>
                    <p>We track <strong>aggregated download counts per audio file</strong>—how many times each track has been downloaded—but these numbers aren't connected to individual users or browsing history.</p>
                </div>

                <div class="legal-section">
                    <h2>2. Discord login & account data</h2>
                    <p>Logging in is optional and uses Discord's OAuth system. When you authorize EndlessAudios, we receive and retain your Discord user ID, display name, username, profile avatar, and banner color. We do <strong>not</strong> collect your email, password, or any Discord direct messages.</p>
                    <p>We use a session cookie (<code>ea_sess</code>) to keep you logged in on the current device. This cookie is HTTP-only (inaccessible to scripts) and expires after 30 days of inactivity. You can log out from individual devices or globally, and all sessions terminate when you delete your account.</p>
                </div>

                <div class="legal-section">
                    <h2>3. Creator profiles</h2>
                    <p>If you upload audios, your public Discord profile (username) appears on your creator page alongside your upload count and download statistics. This is public information from your Discord account. If you wish to remain unlisted, email us and we'll remove your profile from EndlessAudios.</p>
                </div>

                <div class="legal-section">
                    <h2>4. Uploads & favorites</h2>
                    <p>Uploaded files are stored on our servers and displayed publicly. We create a SHA-256 fingerprint of each upload to detect and prevent duplicate submissions. If you mark audios as Favorites, that list is saved on your device using browser local storage and synced to your account (if logged in).</p>
                </div>

                <div class="legal-section">
                    <h2>5. External services</h2>
                    <ul>
                        <li><strong>Supabase</strong> – backend database and authentication provider. Your account data, uploads, and session info are stored here.</li>
                        <li><strong>Discord</strong> – OAuth identity provider. See Discord's privacy policy for how they handle your data.</li>
                        <li><strong>Google Fonts</strong> – we load typography from Google's CDN, which means your IP is visible to Google when you load a page.</li>
                    </ul>
                    <p>We don't sell, trade, or share your data with third-party advertisers or marketing companies.</p>
                </div>

                <div class="legal-section">
                    <h2>6. Your data rights</h2>
                    <p>You can request information about what data we hold, download your uploads, delete uploads, remove your profile, or fully delete your account. Contact us via Discord (<a href="https://discord.gg/2kkGbn5fyz" target="_blank">discord.gg/2kkGbn5fyz</a>). Account deletion removes your profile, uploads, and all active sessions.</p>
                </div>

                <div class="legal-section">
                    <h2>7. Age restriction</h2>
                    <p>EndlessAudios is intended for users 13 and older. We do not knowingly collect data from minors under 13.</p>
                </div>

                <div class="legal-section">
                    <h2>8. Policy updates</h2>
                    <p>We may update this privacy policy at any time. Changes are effective when posted here. The "Last updated" date indicates when this version was published.</p>
                </div>

                <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid var(--border-color);">
                    <button onclick="showHome()" style="background: transparent; color: var(--text-muted); border: none; cursor: pointer; font-size: 13px; font-weight: 500; transition: color 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">← Back to library</button>
                </div>
            </div>
        </div>
    `;
}

loadAudios();