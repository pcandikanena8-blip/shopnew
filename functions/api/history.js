// File ini letaknya di: functions/api/history.js
// Endpoint otomatis jadi: https://namasitus-kamu.pages.dev/api/history?username=xxx
//
// Mengembalikan daftar pesanan milik satu username Roblox, terbaru duluan.
// Membutuhkan KV binding "ORDERS" (sama seperti di checkout.js).

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const username = (url.searchParams.get("username") || "").trim().toLowerCase();

    if (!username) {
      return json({ ok: false, error: "Username wajib diisi." }, 400);
    }

    if (!env.ORDERS) {
      return json({ ok: false, error: "Fitur riwayat belum aktif (KV namespace ORDERS belum di-bind)." }, 500);
    }

    // Ambil semua kunci pesanan, lalu saring berdasarkan metadata username
    // (metadata bisa dibaca tanpa perlu fetch value satu-satu, jadi lebih hemat)
    const list = await env.ORDERS.list({ prefix: "order:" });
    const matches = list.keys.filter((k) => k.metadata && k.metadata.username === username);

    const orders = [];
    for (const key of matches) {
      const raw = await env.ORDERS.get(key.name);
      if (raw) orders.push(JSON.parse(raw));
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return json({ ok: true, orders });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
