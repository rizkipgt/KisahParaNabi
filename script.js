// Inisialisasi PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js";

// Variabel global
let currentPDF = null;
let currentPage = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5;
let bookmarks = {};
let notes = {};
let isMobile = window.matchMedia("(max-width: 768px)").matches;

// Elemen DOM
const canvasLeft = document.getElementById("pdfCanvasLeft");
const canvasRight = document.getElementById("pdfCanvasRight");
const canvasSingle = document.getElementById("pdfCanvasSingle");
const ctxLeft = canvasLeft.getContext("2d");
const ctxRight = canvasRight.getContext("2d");
const ctxSingle = canvasSingle.getContext("2d");
const pageNumElement = document.getElementById("pageNum");
const pageCountElement = document.getElementById("pageCount");
const mobilePageNumElement = document.getElementById("mobilePageNum");
const mobilePageCountElement = document.getElementById("mobilePageCount");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const mobilePrevPageBtn = document.getElementById("mobilePrevPage");
const mobileNextPageBtn = document.getElementById("mobileNextPage");
const pageSearchInput = document.getElementById("pageSearch");
const goToPageBtn = document.getElementById("goToPage");
const addBookmarkBtn = document.getElementById("addBookmark");
const addNoteBtn = document.getElementById("addNote");
const searchTextBtn = document.getElementById("searchText");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const textSearchContainer = document.getElementById("textSearchContainer");
const textSearchInput = document.getElementById("textSearchInput");
const textSearchBtn = document.getElementById("textSearchBtn");
const closeTextSearchBtn = document.getElementById("closeTextSearch");
const searchResultsElement = document.getElementById("searchResults");
const noteModal = document.getElementById("noteModal");
const noteTextArea = document.getElementById("noteText");
const saveNoteBtn = document.getElementById("saveNote");
const cancelNoteBtn = document.getElementById("cancelNote");
const notesListElement = document.getElementById("notesList");
const bookmarksListElement = document.getElementById("bookmarksList");
const bookItems = document.querySelectorAll(".book-item");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const closeSidebarBtn = document.querySelector(".close-sidebar");
const sidebar = document.querySelector(".sidebar");

// Muat data dari localStorage
function loadData() {
  const savedBookmarks = localStorage.getItem("bookmarks");
  const savedNotes = localStorage.getItem("notes");

  if (savedBookmarks) {
    bookmarks = JSON.parse(savedBookmarks);
  }

  if (savedNotes) {
    notes = JSON.parse(savedNotes);
  }

  renderBookmarks();
  renderNotes();
}

// Simpan data ke localStorage
function saveData() {
  localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
  localStorage.setItem("notes", JSON.stringify(notes));
}

// Render halaman PDF
function renderPage(num) {
  pageRendering = true;
  currentPage = num;
  pageNumElement.textContent = num;
  mobilePageNumElement.textContent = num;

  if (isMobile) {
    // Mode mobile - tampilkan single page
    currentPDF.getPage(num).then(function (page) {
      const viewport = page.getViewport({ scale: scale });
      canvasSingle.height = viewport.height;
      canvasSingle.width = viewport.width;

      const renderContext = {
        canvasContext: ctxSingle,
        viewport: viewport,
      };

      page.render(renderContext);
      pageRendering = false;
    });
  } else {
    // Mode desktop - tampilkan two-page spread
    const page1 = num;
    const page2 = num + 1 <= currentPDF.numPages ? num + 1 : null;

    // Render halaman kiri
    currentPDF.getPage(page1).then(function (page) {
      const viewport = page.getViewport({ scale: scale });
      canvasLeft.height = viewport.height;
      canvasLeft.width = viewport.width;

      const renderContext = {
        canvasContext: ctxLeft,
        viewport: viewport,
      };

      page.render(renderContext);

      // Render halaman kanan jika ada
      if (page2) {
        currentPDF.getPage(page2).then(function (page) {
          const viewport = page.getViewport({ scale: scale });
          canvasRight.height = viewport.height;
          canvasRight.width = viewport.width;

          const renderContext = {
            canvasContext: ctxRight,
            viewport: viewport,
          };

          page.render(renderContext);
          pageRendering = false;
        });
      } else {
        // Kosongkan canvas kanan jika tidak ada halaman kedua
        ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height);
        pageRendering = false;
      }
    });
  }
}

// Navigasi ke halaman
function gotoPage(num) {
  if (pageRendering) {
    pageNumPending = num;
  } else {
    // Pastikan nomor halaman valid
    if (num < 1) num = 1;
    if (num > currentPDF.numPages) num = currentPDF.numPages;

    renderPage(num);
  }
}

// Navigasi halaman sebelumnya
function prevPage() {
  if (isMobile) {
    gotoPage(currentPage - 1);
  } else {
    gotoPage(currentPage - 2 >= 1 ? currentPage - 2 : 1);
  }
}

// Navigasi halaman berikutnya
function nextPage() {
  if (isMobile) {
    gotoPage(currentPage + 1);
  } else {
    gotoPage(
      currentPage + 2 <= currentPDF.numPages ? currentPage + 2 : currentPage
    );
  }
}

// Tambah bookmark
function addBookmark() {
  const currentBook = document.querySelector(".book-item.active").dataset.pdf;
  const bookTitle = document
    .querySelector(".book-item.active")
    .textContent.trim();

  if (!bookmarks[currentBook]) {
    bookmarks[currentBook] = [];
  }

  // Cek apakah halaman ini sudah di-bookmark
  const existingIndex = bookmarks[currentBook].findIndex(
    (b) => b.page === currentPage
  );

  if (existingIndex === -1) {
    // Tambahkan bookmark baru
    bookmarks[currentBook].push({
      page: currentPage,
      title: bookTitle,
      timestamp: new Date().toISOString(),
    });

    // Sortir berdasarkan halaman
    bookmarks[currentBook].sort((a, b) => a.page - b.page);
    addBookmarkBtn.classList.add("active");
  } else {
    // Hapus bookmark yang sudah ada
    bookmarks[currentBook].splice(existingIndex, 1);
    addBookmarkBtn.classList.remove("active");

    // Hapus array jika kosong
    if (bookmarks[currentBook].length === 0) {
      delete bookmarks[currentBook];
    }
  }

  saveData();
  renderBookmarks();
}

// Render daftar bookmark
function renderBookmarks() {
  bookmarksListElement.innerHTML = "";

  const allBookmarks = [];

  // Kumpulkan semua bookmark dari semua buku
  Object.entries(bookmarks).forEach(([bookPath, bookBookmarks]) => {
    bookBookmarks.forEach((bookmark) => {
      allBookmarks.push({
        bookPath,
        ...bookmark,
      });
    });
  });

  if (allBookmarks.length === 0) {
    bookmarksListElement.innerHTML =
      '<p class="empty-message">Tidak ada bookmark</p>';
    return;
  }

  // Urutkan bookmark berdasarkan halaman
  allBookmarks.sort((a, b) => a.page - b.page);

  allBookmarks.forEach((bookmark) => {
    const bookmarkElement = document.createElement("div");
    bookmarkElement.className = "bookmark-item";
    bookmarkElement.innerHTML = `
            <div class="bookmark-content">
                <div class="bookmark-title">${bookmark.title}</div>
                <div class="bookmark-meta">
                    <span>Halaman ${bookmark.page}</span>
                    <span>${new Date(
                      bookmark.timestamp
                    ).toLocaleDateString()}</span>
                </div>
            </div>
            <button class="bookmark-remove" data-book="${
              bookmark.bookPath
            }" data-page="${bookmark.page}">
                <i class="fas fa-times"></i>
            </button>
        `;

    // Navigasi saat klik bookmark
    bookmarkElement
      .querySelector(".bookmark-content")
      .addEventListener("click", () => {
        navigateToBookmark(bookmark.bookPath, bookmark.page);
      });

    bookmarksListElement.appendChild(bookmarkElement);
  });

  // Tambahkan event listener untuk tombol hapus
  document.querySelectorAll(".bookmark-remove").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      removeBookmark(this.dataset.book, parseInt(this.dataset.page));
    });
  });
}

// Fungsi navigasi ke bookmark
function navigateToBookmark(bookPath, pageNumber) {
  // Temukan item buku yang sesuai dan aktifkan
  bookItems.forEach((item) => {
    if (item.dataset.pdf === bookPath) {
      item.classList.add("active");
      // Load PDF jika belum aktif
      if (
        document.querySelector(".book-item.active").dataset.pdf !== bookPath
      ) {
        loadPDF(bookPath);
      }
      gotoPage(pageNumber);
    } else {
      item.classList.remove("active");
    }
  });

  closeSidebar();
}

// Fungsi hapus bookmark
function removeBookmark(bookPath, pageNumber) {
  if (bookmarks[bookPath]) {
    const index = bookmarks[bookPath].findIndex((b) => b.page === pageNumber);
    if (index !== -1) {
      bookmarks[bookPath].splice(index, 1);

      // Hapus array jika kosong
      if (bookmarks[bookPath].length === 0) {
        delete bookmarks[bookPath];
      }

      saveData();
      renderBookmarks();
    }
  }
}

// Render daftar catatan
function renderNotes() {
  notesListElement.innerHTML = "";

  const notesArray = [];

  // Kumpulkan semua catatan dari semua buku
  Object.entries(notes).forEach(([bookPath, bookNotes]) => {
    Object.entries(bookNotes).forEach(([noteId, note]) => {
      notesArray.push({
        bookPath,
        noteId,
        ...note,
      });
    });
  });

  if (notesArray.length === 0) {
    notesListElement.innerHTML =
      '<p class="empty-message">Tidak ada catatan</p>';
    return;
  }

  // Urutkan catatan berdasarkan timestamp terbaru
  notesArray.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  notesArray.forEach((note) => {
    const noteElement = document.createElement("div");
    noteElement.className = "note-item";
    noteElement.innerHTML = `
            <div class="note-content">
                <p>${note.text}</p>
                <div class="note-meta">
                    <span>${note.title} - Halaman ${note.page}</span>
                    <span>${new Date(
                      note.timestamp
                    ).toLocaleDateString()}</span>
                </div>
            </div>
            <button class="note-remove" data-book="${note.bookPath}" data-id="${
      note.noteId
    }">
                <i class="fas fa-times"></i>
            </button>
        `;

    // Navigasi saat klik catatan
    noteElement.querySelector(".note-content").addEventListener("click", () => {
      navigateToNote(note.bookPath, note.page);
    });

    notesListElement.appendChild(noteElement);
  });

  // Tambahkan event listener untuk tombol hapus catatan
  document.querySelectorAll(".note-remove").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      removeNote(this.dataset.book, this.dataset.id);
    });
  });
}

// Fungsi navigasi ke catatan
function navigateToNote(bookPath, pageNumber) {
  // Temukan item buku yang sesuai dan aktifkan
  bookItems.forEach((item) => {
    if (item.dataset.pdf === bookPath) {
      item.classList.add("active");
      // Load PDF jika belum aktif
      if (
        document.querySelector(".book-item.active").dataset.pdf !== bookPath
      ) {
        loadPDF(bookPath);
      }
      gotoPage(pageNumber);
    } else {
      item.classList.remove("active");
    }
  });

  closeSidebar();
}

// Fungsi hapus catatan
function removeNote(bookPath, noteId) {
  if (notes[bookPath] && notes[bookPath][noteId]) {
    delete notes[bookPath][noteId];

    // Hapus objek buku jika tidak ada catatan lagi
    if (Object.keys(notes[bookPath]).length === 0) {
      delete notes[bookPath];
    }

    saveData();
    renderNotes();
  }
}

// Buka modal catatan
function openNoteModal() {
  noteModal.classList.remove("hidden");
  noteTextArea.focus();
}

// Tutup modal catatan
function closeNoteModal() {
  noteModal.classList.add("hidden");
  noteTextArea.value = "";
}

// Simpan catatan
function saveNote() {
  const noteText = noteTextArea.value.trim();
  if (noteText === "") return;

  const currentBook = document.querySelector(".book-item.active").dataset.pdf;
  const bookTitle = document
    .querySelector(".book-item.active")
    .textContent.trim();
  const noteId = "note-" + Date.now().toString();

  if (!notes[currentBook]) {
    notes[currentBook] = {};
  }

  notes[currentBook][noteId] = {
    text: noteText,
    page: currentPage,
    title: bookTitle,
    timestamp: new Date().toISOString(),
  };

  saveData();
  renderNotes();
  closeNoteModal();
}

// Zoom in
function zoomIn() {
  scale += 0.25;
  renderPage(currentPage);
}

// Zoom out
function zoomOut() {
  if (scale > 0.5) {
    scale -= 0.25;
    renderPage(currentPage);
  }
}

// Cari teks dalam PDF
function searchText() {
  textSearchContainer.classList.remove("hidden");
  textSearchInput.focus();
}

function closeTextSearch() {
  textSearchContainer.classList.add("hidden");
  textSearchInput.value = "";
  searchResultsElement.innerHTML = "";
}

function performTextSearch() {
  const query = textSearchInput.value.trim();
  if (query === "") return;

  searchResultsElement.innerHTML = "<p>Mencari...</p>";

  // Implementasi pencarian teks sederhana (untuk demo)
  searchResultsElement.innerHTML = `
        <p>Fitur pencarian teks lengkap membutuhkan implementasi lebih lanjut dengan PDF.js text layer.</p>
        <p>Untuk demo, Anda dapat menggunakan fitur bookmark dan catatan.</p>
    `;
}

// Muat PDF
function loadPDF(url) {
  pdfjsLib
    .getDocument(url)
    .promise.then(function (pdf) {
      currentPDF = pdf;
      pageCountElement.textContent = pdf.numPages;
      mobilePageCountElement.textContent = pdf.numPages;

      // Periksa apakah ada bookmark untuk buku ini
      const currentBook =
        document.querySelector(".book-item.active").dataset.pdf;
      if (bookmarks[currentBook] && bookmarks[currentBook].length > 0) {
        // Pergi ke bookmark terakhir untuk buku ini
        const lastBookmark =
          bookmarks[currentBook][bookmarks[currentBook].length - 1];
        currentPage = lastBookmark.page;
      } else {
        currentPage = 1;
      }

      renderPage(currentPage);
    })
    .catch(function (error) {
      console.error("Error loading PDF:", error);
      alert("Gagal memuat PDF. Pastikan file tersedia.");
    });
}

// Handle resize
function handleResize() {
  const wasMobile = isMobile;
  isMobile = window.matchMedia("(max-width: 768px)").matches;

  // Jika status mobile berubah, render ulang halaman
  if (wasMobile !== isMobile) {
    renderPage(currentPage);
  }
}

// Toggle sidebar di mobile
function toggleSidebar() {
  sidebar.classList.toggle("expanded");
}

function closeSidebar() {
  if (isMobile) {
    sidebar.classList.remove("expanded");
  }
}

// Event Listeners
prevPageBtn.addEventListener("click", prevPage);
nextPageBtn.addEventListener("click", nextPage);
mobilePrevPageBtn.addEventListener("click", prevPage);
mobileNextPageBtn.addEventListener("click", nextPage);

goToPageBtn.addEventListener("click", () => {
  const pageNum = parseInt(pageSearchInput.value);
  if (pageNum > 0 && pageNum <= currentPDF.numPages) {
    gotoPage(pageNum);
  }
});

addBookmarkBtn.addEventListener("click", addBookmark);
addNoteBtn.addEventListener("click", openNoteModal);
searchTextBtn.addEventListener("click", searchText);
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);

saveNoteBtn.addEventListener("click", saveNote);
cancelNoteBtn.addEventListener("click", closeNoteModal);

textSearchBtn.addEventListener("click", performTextSearch);
closeTextSearchBtn.addEventListener("click", closeTextSearch);

// Load buku ketika item buku diklik
bookItems.forEach((item) => {
  item.addEventListener("click", () => {
    bookItems.forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    loadPDF(item.dataset.pdf);
    closeSidebar();
  });
});

// Handle scroll untuk mobile
document
  .querySelector(".reader-container")
  .addEventListener("scroll", function () {
    if (isMobile) {
      const container = this;
      const scrollBottom = container.scrollTop + container.clientHeight;

      // Jika sudah sampai bawah, load halaman berikutnya
      if (
        scrollBottom >= container.scrollHeight - 50 &&
        currentPage < currentPDF.numPages
      ) {
        gotoPage(currentPage + 1);
      }
    }
  });

// Handle resize
window.addEventListener("resize", handleResize);

// Toggle sidebar
mobileMenuToggle.addEventListener("click", toggleSidebar);
closeSidebarBtn.addEventListener("click", closeSidebar);

// Load data dan buku pertama saat halaman dimuat
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  loadPDF(document.querySelector(".book-item.active").dataset.pdf);
});

// Handle keyboard navigation
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" && !isMobile) {
    prevPage();
  } else if (e.key === "ArrowRight" && !isMobile) {
    nextPage();
  } else if (e.key === "Escape") {
    if (!noteModal.classList.contains("hidden")) {
      closeNoteModal();
    }
    if (!textSearchContainer.classList.contains("hidden")) {
      closeTextSearch();
    }
    closeSidebar();
  }
});
