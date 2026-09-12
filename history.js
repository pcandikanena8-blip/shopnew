const STORAGE_KEY = "robloxUsername";

function el(id) { return document.getElementById(id); }

function showLogin() {
  el("loginCard").classList.remove("hidden");
  el("historyView").classList.add("hidden");
}

function showHistoryView() {
  el("loginCard").classList.add("hidden");
  el("historyView").classList.remove("hidden");
}

function statusLabel(status) {
  return status === "sukses" ? "Sukses" : "Pending";
}

function statusClass(status) {
  return status === "sukses" ? "status-sukses" : "status-pending";
}

async function loadHistory(username) {
  el("historyUsername").textContent = username;
  el("historyList").innerHTML = "<p class='muted'>Memuat riwayat...</p>";
  showHistoryView();

  try {
    const res = await fetch(`/api/history?username=${encodeURIComponent(username)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Gagal memuat riwayat.");

    if (!data.orders.length) {
      el("historyList").innerHTML = "<p class='muted'>Belum ada pesanan tercatat untuk username ini.</p>";
      return;
    }

    el("historyList").innerHTML = data.orders.map(o => `
      <div class="history-item">
        <div class="history-item-top">
          <b>${o.order}</b>
          <span class="status-badge ${statusClass(o.status)}">${statusLabel(o.status)}</span>
        </div>
        <div class="history-item-body">
          <div>${(o.products || "-").replace(/\n/g, "<br>")}</div>
          <div class="muted">Metode: ${o.payment} · Total: ${o.total}</div>
          <div class="muted">Tanggal: ${new Date(o.createdAt).toLocaleString("id-ID")}</div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    el("historyList").innerHTML = `<p class="muted">Terjadi kesalahan: ${err.message}</p>`;
  }
}

el("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const username = el("loginUsername").value.trim();
  if (!username) return;
  localStorage.setItem(STORAGE_KEY, username);
  loadHistory(username);
});

el("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  el("loginUsername").value = "";
  showLogin();
});

el("refreshBtn").addEventListener("click", () => {
  const username = localStorage.getItem(STORAGE_KEY);
  if (username) loadHistory(username);
});

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  el("loginUsername").value = saved;
  loadHistory(saved);
} else {
  showLogin();
}
