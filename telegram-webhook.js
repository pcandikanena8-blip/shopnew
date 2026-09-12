// File ini letaknya di: functions/api/telegram-webhook.js
// Endpoint otomatis jadi: https://namasitus-kamu.pages.dev/api/telegram-webhook
//
// Ini menerima update dari Telegram setiap kali admin menekan tombol
// "✅ Tandai Sukses" di bawah notifikasi pesanan, lalu mengubah status
// pesanan tersebut di KV menjadi "sukses".
//
// SETUP (dilakukan sekali saja setelah deploy):
// 1. Pastikan KV namespace sudah di-bind dengan nama "ORDERS"
//    (sama persis seperti yang dipakai di checkout.js).
// 2. (Opsional, tapi disarankan) Set environment variable TELEGRAM_WEBHOOK_SECRET
//    berupa string acak, contoh: "abc123rahasia". Ini mencegah orang lain
//    mengirim request palsu ke endpoint ini.
// 3. Daftarkan webhook ke Telegram dengan membuka URL berikut SEKALI saja di browser
//    (ganti <BOT_TOKEN>, <DOMAIN>, dan <SECRET> sesuai punya kamu):
//
//    https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<DOMAIN>/api/telegram-webhook&secret_token=<SECRET>
//
//    Kalau tidak pakai TELEGRAM_WEBHOOK_SECRET, hapus saja bagian "&secret_token=...".

export async function onRequestPost({ request, env }) {
  try {
    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
    }

    const update = await request.json();
    const cq = update.callback_query;

    if (cq && cq.data && env.ORDERS && env.BOT_TOKEN) {
      const [action, orderCode] = cq.data.split(":");
      if (action === "sukses" && orderCode) {
        await markOrderSukses(env, orderCode, cq);
      }
    }

    // Selalu balas 200 OK supaya Telegram tidak mengirim ulang update yang sama
    return new Response("OK", { status: 200 });
  } catch (err) {
    return new Response("OK", { status: 200 });
  }
}

async function markOrderSukses(env, orderCode, cq) {
  const key = `order:${orderCode}`;
  const raw = await env.ORDERS.get(key);

  if (!raw) {
    await answerCallback(env, cq.id, "Pesanan tidak ditemukan.");
    return;
  }

  const orderData = JSON.parse(raw);

  if (orderData.status === "sukses") {
    await answerCallback(env, cq.id, "Pesanan ini sudah ditandai sukses sebelumnya.");
    return;
  }

  orderData.status = "sukses";
  orderData.updatedAt = new Date().toISOString();

  await env.ORDERS.put(key, JSON.stringify(orderData), {
    metadata: {
      username: (orderData.username || "").toLowerCase(),
      status: "sukses",
      createdAt: orderData.createdAt,
    },
  });

  await updateTelegramMessage(env, orderData);
  await answerCallback(env, cq.id, "Ditandai sukses ✅");
}

async function updateTelegramMessage(env, orderData) {
  const { chatId, messageId } = orderData;
  if (!chatId || !messageId) return;

  const text = buildCaption(orderData) + "\n\n✅ *SUKSES* — ditandai oleh admin";
  const method = orderData.hasProof ? "editMessageCaption" : "editMessageText";
  const params = {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: JSON.stringify({ inline_keyboard: [] }),
  };
  params[orderData.hasProof ? "caption" : "text"] = text;

  await tgCall(env, method, params);
}

function buildCaption(o) {
  return `🛒 *Pesanan*\nNo: ${o.order}\nUsername Roblox: ${o.username}\nMetode: ${o.payment}\nTotal: ${o.total}\n\nProduk:\n${o.products}`;
}

async function tgCall(env, method, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function answerCallback(env, callbackQueryId, text) {
  return tgCall(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: "false",
  });
}
