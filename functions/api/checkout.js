// File ini letaknya di: functions/api/checkout.js
// Endpoint otomatis jadi: https://namasitus-kamu.pages.dev/api/checkout
//
// Environment Variables (Cloudflare Pages > Settings > Variables and secrets):
//   BOT_TOKEN        -> WAJIB, set sebagai tipe "Secret". Token dari @BotFather.
//   ADMIN_CHAT_ID    -> WAJIB. Chat id kamu.
//   FRONTEND_ORIGIN  -> opsional. Kalau diisi, hanya request dari origin ini yang diterima.
//   MAX_UPLOAD_MB    -> opsional. Batas ukuran file bukti bayar (default 8MB kalau kosong).
//
// KV Binding (Cloudflare Pages > Settings > Functions > KV namespace bindings):
//   ORDERS -> WAJIB untuk fitur riwayat pesanan & tombol "Tandai Sukses" di bot.
//             Kalau belum di-bind, checkout tetap jalan seperti biasa, hanya saja
//             pesanan tidak akan tercatat di riwayat.

export async function onRequestPost({ request, env }) {
  try {
    const origin = request.headers.get("Origin");
    if (env.FRONTEND_ORIGIN && origin && origin !== env.FRONTEND_ORIGIN) {
      return json({ ok: false, error: "Origin tidak diizinkan." }, 403);
    }

    if (!env.BOT_TOKEN || !env.ADMIN_CHAT_ID) {
      return json({ ok: false, error: "BOT_TOKEN / ADMIN_CHAT_ID belum diset di environment variables." }, 500);
    }

    const formData = await request.formData();

    const order = (formData.get("order") || "-").toString();
    const username = (formData.get("username") || "-").toString();
    const payment = (formData.get("payment") || "-").toString();
    const total = (formData.get("total") || "-").toString();
    const productsList = (formData.get("products") || "-").toString();
    const proof = formData.get("proof"); // file, bisa kosong

    const maxBytes = (Number(env.MAX_UPLOAD_MB) || 8) * 1024 * 1024;
    if (proof && typeof proof === "object" && proof.size > maxBytes) {
      return json({ ok: false, error: `File terlalu besar. Maksimal ${Number(env.MAX_UPLOAD_MB) || 8}MB.` }, 413);
    }

    const caption = buildCaption({ order, username, payment, total, products: productsList });
    const hasProof = proof && typeof proof === "object" && proof.size > 0;

    const tgForm = new FormData();
    tgForm.append("chat_id", env.ADMIN_CHAT_ID);
    tgForm.append("parse_mode", "Markdown");
    tgForm.append(
      "reply_markup",
      JSON.stringify({
        inline_keyboard: [[{ text: "✅ Tandai Sukses", callback_data: `sukses:${order}` }]],
      })
    );

    let tgUrl;
    if (hasProof) {
      tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`;
      tgForm.append("caption", caption);
      tgForm.append("photo", proof, proof.name || "bukti.jpg");
    } else {
      tgUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
      tgForm.append("text", caption);
    }

    const tgRes = await fetch(tgUrl, { method: "POST", body: tgForm });
    const tgData = await tgRes.json().catch(() => null);

    if (!tgRes.ok || !tgData || !tgData.ok) {
      const errText = tgData ? JSON.stringify(tgData) : await tgRes.text();
      return json({ ok: false, error: `Telegram API error: ${errText}` }, 502);
    }

    // Simpan ke KV supaya bisa muncul di riwayat pesanan & tombol "Tandai Sukses" berfungsi
    if (env.ORDERS) {
      const createdAt = new Date().toISOString();
      const orderData = {
        order,
        username,
        payment,
        total,
        products: productsList,
        status: "pending",
        hasProof,
        chatId: tgData.result.chat.id,
        messageId: tgData.result.message_id,
        createdAt,
      };
      await env.ORDERS.put(`order:${order}`, JSON.stringify(orderData), {
        metadata: { username: username.toLowerCase(), status: "pending", createdAt },
      });
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function buildCaption({ order, username, payment, total, products }) {
  return `🛒 *Pesanan Baru*\nNo: ${order}\nUsername Roblox: ${username}\nMetode: ${payment}\nTotal: ${total}\n\nProduk:\n${products}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
