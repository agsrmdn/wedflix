/**
 * --------------------------------------------------------------------------
 * WEDDING CODE - CORE LOGIC & SUPABASE INTEGRATION (WEDFLIX ULTIMATE)
 * --------------------------------------------------------------------------
 */

// Inisialisasi Klien Supabase
const { createClient } = supabase;
const _supabase = createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey,
);

const bgMusic = document.getElementById("bg-music");
const musicIcon = document.getElementById("music-icon");
const floatingBtn = document.getElementById("floating-music-btn");
let playPromise;
let isPlayPending = false;
let userHasInteracted = false;
let currentCoupleId = null; // Menyimpan UUID asli dari database berdasarkan slug

function toggleMusic(event) {
  if (event) event.stopPropagation();
  if (isPlayPending) return;

  if (bgMusic.paused) {
    isPlayPending = true;
    playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          musicIcon.classList.add("spin-animation");
          floatingBtn.style.background = "rgba(229, 9, 20, 1)";
          isPlayPending = false;
        })
        .catch(() => {
          isPlayPending = false;
        });
    }
  } else {
    if (playPromise !== undefined) {
      isPlayPending = true;
      playPromise
        .then(() => {
          bgMusic.pause();
          musicIcon.classList.remove("spin-animation");
          floatingBtn.style.background = "rgba(100, 100, 100, 0.5)";
          isPlayPending = false;
        })
        .catch(() => {
          isPlayPending = false;
        });
    } else {
      bgMusic.pause();
      musicIcon.classList.remove("spin-animation");
      floatingBtn.style.background = "rgba(100, 100, 100, 0.5)";
    }
  }
  userHasInteracted = true;
}

const startMusicOnInteraction = () => {
  if (!userHasInteracted && bgMusic.paused && !isPlayPending) {
    isPlayPending = true;
    playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          musicIcon.classList.add("spin-animation");
          isPlayPending = false;
          userHasInteracted = true;
        })
        .catch(() => {
          isPlayPending = false;
        });
    }
  }
  window.removeEventListener("click", startMusicOnInteraction);
  window.removeEventListener("scroll", startMusicOnInteraction);
};
window.addEventListener("click", startMusicOnInteraction);
window.addEventListener("scroll", startMusicOnInteraction, { once: true });

document.getElementById("btn-buka").addEventListener("click", function () {
  const intro = document.getElementById("intro-screen");
  const main = document.getElementById("main-content");
  intro.style.opacity = "0";
  intro.style.transform = "scale(1.2)";
  startMusicOnInteraction();
  setTimeout(() => {
    intro.style.display = "none";
    main.classList.remove("hidden");
    document
      .querySelectorAll(".reveal-hidden, .netflix-glow-title")
      .forEach((el) => {
        revealObserver.observe(el);
      });
    // Ambil data ucapan setelah undangan dibuka
    fetchComments();
  }, 800);
});

const modal = document.getElementById("global-modal");
const modalBox = document.getElementById("modal-content-box");
function showModal(title, body) {
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-body").innerText = body;
  modal.classList.remove("hidden");
  setTimeout(() => {
    modal.classList.remove("opacity-0");
    modalBox.classList.remove("scale-95");
  }, 10);
}
function closeModal() {
  modal.classList.add("opacity-0");
  modalBox.classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
}

// --- AMBIL UUID PASANGAN BERDASARKAN SLUG & DETEKSI NAMA TAMU ---
async function initCoupleBySlug() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. Dukung parameter ?client=, ?clients=, atau ?slug=
  const targetSlug =
    urlParams.get("client") ||
    urlParams.get("clients") ||
    urlParams.get("slug") ||
    window.SUPABASE_CONFIG?.slug ||
    "demo";

  // 2. OTOMATISASI PENARIKAN ASET KLIEN (VERCEL READY)
  const CLIENT_URL = `/clients/${targetSlug}`;
  const TEMPLATE_FOTO = `${CLIENT_URL}/main1.webp`;

  // Audio Player
  const audioEl =
    document.getElementById("bg-music") ||
    document.getElementById("musik") ||
    document.querySelector("audio");
  if (audioEl) audioEl.src = `${CLIENT_URL}/musik.mp3`;

  // Map Otomatis Gambar Berdasarkan ID (main1-3, galeri1-10, akad, resepsi, foto-poster, dll.)
  document.querySelectorAll("img[id]").forEach((img) => {
    const fileExt = img.src.split(".").pop() || "webp";
    const targetSrc = `${CLIENT_URL}/${img.id}.${fileExt.length > 4 ? "webp" : fileExt}`;

    img.src = targetSrc;

    // Fallback template jika gambar spesifik belum diunggah
    img.onerror = () => {
      img.onerror = null;
      img.src = TEMPLATE_FOTO;
    };
  });

  // Tangkap parameter nama tamu (?to=...)
  const namaTamuParam = urlParams.get("to");
  const namaTamuFinal = namaTamuParam
    ? decodeURIComponent(namaTamuParam)
    : "Tamu VIP";

  // 1. Otomatis isi nama tamu ke form RSVP (terkunci)
  const inputNamaEl =
    document.getElementById("rsvp-name") ||
    document.getElementById("input-nama");
  if (inputNamaEl) {
    inputNamaEl.value = namaTamuFinal;
  }

  // 2. Tampilkan nama tamu di Cover Depan (Intro Screen)
  const namaCoverEl = document.getElementById("nama-tamu-cover");
  if (namaCoverEl) {
    namaCoverEl.textContent = namaTamuFinal;
  }

  try {
    const { data, error } = await _supabase
      .from("pasangan")
      .select("id, nama_pria, nama_wanita, tanggal_acara, lokasi_acara")
      .eq("slug", targetSlug)
      .single();

    if (error || !data) {
      console.error("Slug pasangan tidak ditemukan di database:", targetSlug);
      return;
    }

    currentCoupleId = data.id; // Menyimpan UUID asli untuk relasi tabel
    console.log("UUID Pasangan aktif:", currentCoupleId);
    fetchComments();
  } catch (err) {
    console.error("Gagal menginisialisasi slug pasangan:", err.message);
  }
}

// --- SUPABASE: FETCH UCAPAN & BALASAN (Tanpa Banner Hadir/Tidak Hadir) ---
// --- SUPABASE: FETCH UCAPAN & BALASAN (Dengan Tombol Balas) ---
async function fetchComments() {
  const container = document.getElementById("comments-container");
  if (!container || !currentCoupleId) return;

  try {
    const { data: ucapanList, error } = await _supabase
      .from("ucapan_tamu")
      .select(
        `
        *,
        balasan_ucapan (*)
      `,
      )
      .eq("pasangan_id", currentCoupleId)
      .order("dibuat_pada", { ascending: false });

    if (error) throw error;

    if (ucapanList && ucapanList.length > 0) {
      container.innerHTML = "";
      ucapanList.forEach((item) => {
        let repliesHtml = "";
        if (item.balasan_ucapan && item.balasan_ucapan.length > 0) {
          item.balasan_ucapan.forEach((reply) => {
            // Jika nama yang membalas sama dengan nama mempelai pria/wanita, beri badge Creator
            const isCreator =
              reply.nama.toLowerCase().includes("creator") ||
              reply.nama === "Romeo & Juliet" ||
              reply.nama === window.SUPABASE_CONFIG?.namaPasangan;

            repliesHtml += `
              <div class="ml-4 mt-2 pl-3 border-l-2 border-red-600 bg-[#222222]/50 p-2.5 rounded-r">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-[11px] font-bold ${isCreator ? "text-red-500" : "text-gray-400"} flex items-center gap-1">
                    ${isCreator ? '<i class="ph-fill ph-shield-check"></i>' : ""} ${escapeHtml(reply.nama)} ${isCreator ? "(Creator)" : ""}
                  </span>
                </div>
                <p class="text-[11px] text-gray-300">${escapeHtml(reply.isi)}</p>
              </div>
            `;
          });
        }

        const commentCard = document.createElement("div");
        commentCard.className =
          "bg-[#181818]/80 backdrop-blur-sm p-4 rounded-xl border border-gray-800/80 shadow-md mb-3";

        // Ambil nama tamu otomatis dari input untuk form balasan
        const defaultNama = document.getElementById("rsvp-name")?.value || "";

        commentCard.innerHTML = `
          <div class="flex justify-between items-start mb-1">
            <h5 class="font-bold text-sm text-white tracking-wide">${escapeHtml(item.nama)}</h5>
          </div>
          <p class="text-xs text-gray-300 mb-2.5 leading-relaxed">"${escapeHtml(item.ucapan)}"</p>
          <span class="text-[9px] font-mono text-gray-500 block mb-2">${item.dibuat_pada ? new Date(item.dibuat_pada).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Baru saja"}</span>
          
          ${repliesHtml}

          <!-- Tombol Balas & Form Interaktif -->
          <button type="button" class="btn-balas flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-widest mt-3">
            <i class="ph-bold ph-arrow-u-down-left"></i> Balas
          </button>
          
          <form class="form-balas hidden mt-3 pt-3 border-t border-gray-800/60 space-y-2" data-ucapan-id="${item.id}">
            <input type="text" required placeholder="Nama Anda..." value="${escapeHtml(defaultNama)}" class="w-full bg-[#111] border border-gray-800 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600 transition" />
            <textarea rows="2" required placeholder="Tulis balasan..." class="w-full bg-[#111] border border-gray-800 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600 transition resize-none"></textarea>
            <div class="flex items-center gap-2">
              <button type="submit" class="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-4 py-1.5 rounded transition uppercase tracking-wider">Kirim</button>
              <button type="button" class="btn-batal-balas text-gray-500 hover:text-gray-300 text-[10px] font-bold px-3 py-1.5 transition uppercase tracking-wider">Batal</button>
            </div>
          </form>
        `;
        container.appendChild(commentCard);
      });
    } else {
      container.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Belum ada ulasan yang masuk.</p>`;
    }
  } catch (err) {
    console.error("Gagal memuat ulasan:", err.message);
  }
}

// --- LOGIKA INTERAKSI & SUBMIT BALASAN ---
const commentsContainer = document.getElementById("comments-container");
if (commentsContainer) {
  // Toggle Buka/Tutup Form Balasan
  commentsContainer.addEventListener("click", (e) => {
    const btnBalas = e.target.closest(".btn-balas");
    if (btnBalas) {
      const form = btnBalas.nextElementSibling;
      if (form && form.classList.contains("form-balas")) {
        form.classList.toggle("hidden");
        if (!form.classList.contains("hidden"))
          form.querySelector("textarea")?.focus();
      }
      return;
    }
    const btnBatal = e.target.closest(".btn-batal-balas");
    if (btnBatal) {
      btnBatal.closest(".form-balas")?.classList.add("hidden");
    }
  });

  // Submit Balasan ke Supabase
  commentsContainer.addEventListener("submit", async (e) => {
    if (e.target.classList.contains("form-balas")) {
      e.preventDefault();
      const form = e.target;
      const ucapanId = form.dataset.ucapanId;
      const inputNama = form.querySelector("input").value.trim();
      const isi = form.querySelector("textarea").value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');

      if (!isi || !currentCoupleId) return;

      submitBtn.textContent = "Mengirim...";
      submitBtn.disabled = true;

      try {
        const { error } = await _supabase.from("balasan_ucapan").insert([
          {
            ucapan_id: ucapanId,
            pasangan_id: currentCoupleId, // Menggunakan UUID pasangan yang aktif
            nama: inputNama,
            isi: isi,
          },
        ]);

        if (error) throw error;

        // Refresh komentar setelah berhasil
        fetchComments();
      } catch (err) {
        console.error("Gagal mengirim balasan:", err.message);
        if (typeof showModal === "function") {
          showModal(
            "Gagal Mengirim",
            "Terjadi kesalahan saat membalas: " + err.message,
          );
        } else {
          alert("Gagal membalas: " + err.message);
        }
        submitBtn.textContent = "Kirim";
        submitBtn.disabled = false;
      }
    }
  });
}

// --- SUPABASE: SUBMIT RSVP & UCAPAN ---
async function submitRsvp(event) {
  event.preventDefault();

  const nameInput =
    document.getElementById("rsvp-name") ||
    document.getElementById("input-nama");
  const statusInput =
    document.getElementById("rsvp-status") ||
    document.getElementById("input-kehadiran");
  const commentInput =
    document.getElementById("rsvp-comment") ||
    document.getElementById("input-ucapan");

  const name = nameInput ? nameInput.value.trim() : "Tamu Undangan";
  const status = statusInput ? statusInput.value : "Hadir";
  const comment = commentInput ? commentInput.value.trim() : "";

  if (!currentCoupleId) {
    showModal("Gagal Mengirim", "ID Pasangan belum terdeteksi dari database.");
    return;
  }

  if (!comment) {
    showModal("Peringatan", "Silakan tulis ucapan terlebih dahulu.");
    return;
  }

  try {
    const { error } = await _supabase.from("ucapan_tamu").insert([
      {
        pasangan_id: currentCoupleId, // Menggunakan UUID yang sah
        nama: name,
        kehadiran: status,
        ucapan: comment,
      },
    ]);

    if (error) throw error;

    showModal(
      "Ulasan Berhasil Dikirim!",
      `Terima kasih ${name}, konfirmasi kehadiran dan ulasan Anda telah tersimpan.`,
    );

    // Reset pesan saja (nama tetap dipertahankan karena terkunci dari link)
    if (commentInput) commentInput.value = "";
    fetchComments();
  } catch (err) {
    console.error("Gagal mengirim RSVP:", err.message);
    showModal("Gagal Mengirim", "Terjadi kesalahan: " + err.message);
  }
}

const rsvpForm = document.getElementById("rsvp-form");
if (rsvpForm) {
  rsvpForm.addEventListener("submit", submitRsvp);
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}

// --- 4. ADD TO CALENDAR ---
function addToCalendar() {
  const title = encodeURIComponent("Pernikahan (The Premiere)");
  const details = encodeURIComponent(
    "Nantikan penayangan eksklusif ikatan janji suci.",
  );
  const location = encodeURIComponent("Grand Ballroom / Gedung Acara");
  const startTime = "20261231T080000Z";
  const endTime = "20261231T140000Z";

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;

  if (isIOS) {
    const icsContent =
      "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Pernikahan\nDTSTART:20261231T080000Z\nDTEND:20261231T140000Z\nEND:VEVENT\nEND:VCALENDAR";
    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", "wedding.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    window.open(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${location}`,
      "_blank",
    );
  }
}

// --- 5. COUNTDOWN ---
const targetDate = new Date("Dec 31, 2026 08:00:00").getTime();
const countdownTimer = setInterval(function () {
  const now = new Date().getTime();
  const distance = targetDate - now;
  if (distance < 0) {
    clearInterval(countdownTimer);
    return;
  }
  const hariEl = document.getElementById("cd-hari");
  const jamEl = document.getElementById("cd-jam");
  const mntEl = document.getElementById("cd-mnt");
  const dtkEl = document.getElementById("cd-dtk");

  if (hariEl)
    hariEl.innerText = Math.floor(distance / (1000 * 60 * 60 * 24))
      .toString()
      .padStart(2, "0");
  if (jamEl)
    jamEl.innerText = Math.floor(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    )
      .toString()
      .padStart(2, "0");
  if (mntEl)
    mntEl.innerText = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      .toString()
      .padStart(2, "0");
  if (dtkEl)
    dtkEl.innerText = Math.floor((distance % (1000 * 60)) / 1000)
      .toString()
      .padStart(2, "0");
}, 1000);

const observerOptions = { root: null, rootMargin: "0px", threshold: 0.1 };
const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((projectEntry) => {
    if (projectEntry.isIntersecting) {
      projectEntry.target.classList.add("reveal-visible");
      observer.unobserve(projectEntry.target);
    }
  });
}, observerOptions);

// Jalankan inisialisasi slug saat dokumen dimuat
document.addEventListener("DOMContentLoaded", () => {
  initCoupleBySlug();
});
