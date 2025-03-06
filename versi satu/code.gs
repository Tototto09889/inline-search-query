var token = "7849305390:AAHsD9O-IhGyLnCJPxOoIg1a_acn5spNOFA"; // GANTI DENGAN TOKEN BOT ANDA
const tg = new telegram.daftar(token);
const adminBot = 2109541199; // GANTI dengan ID admin kamu (jika bukan ini)
const spreadsheetId = "10TupgRfroPas2SjNNY19Q4uB82AYGUVwIIisBxb9Mgg"; // GANTI DENGAN ID SPREADSHEET ANDA
const debug = false; // Biarkan false

// --- Fungsi-fungsi Telegram ---
function getMe() {
    let me = tg.getMe();
    Logger.log("getMe: " + JSON.stringify(me));
    return me;
}

function setWebhook() {
    var url = "https://script.google.com/macros/s/AKfycbzK3YwRKK4WRwc51E8j_1KTO1dttfOrMkRxs03wvp1HX3xKHHKnMq0cmSwftoKyfN6uaQ/exec"; // GANTI dengan URL Web App kamu setelah deploy!
    var r = tg.setWebhook(url);
    Logger.log("setWebhook: " + r);
    return r;
}

function getWebhookInfo() {
    let hasil = tg.getWebhookInfo();
    Logger.log("getWebhookInfo: " + JSON.stringify(hasil));
    return hasil;
}

function deleteWebhook() {
    let hasil = tg.deleteWebhook();
    Logger.log("deleteWebhook: " + hasil);
    return hasil;
}

// --- Fungsi utama (doPost) ---
function doPost(e) {
    try {
        if (debug) {
            tg.sendMessage(adminBot, JSON.stringify(e, null, 2));
        }

        let update = JSON.parse(e.postData.contents);

        Logger.log("doPost dijalankan!");
        Logger.log("Update yang diterima: " + JSON.stringify(update, null, 2));

        // Handle inline queries
        if (update.inline_query) {
            handleInlineQuery(update.inline_query);
            return;
        }

        // Handle callback queries
        if (update.callback_query) {
            handleCallbackQuery(update.callback_query);
            return;
        }

        // Handle pesan biasa
        if (update.message) {
            let msg = update.message;
            Logger.log("Pesan diterima: " + JSON.stringify(msg, null, 2));

            if (msg.from.id == adminBot) {
                if (msg.text == "/start") {
                    startCommand(msg);
                } else if(msg.text == "/help"){
                    handleHelpCommand(msg)
                }
                
                else if (msg.forward_from || msg.forward_from_chat || msg.photo || msg.document) {
                    saveForwardedMessage(msg);
                } else {
                    tg.sendMessage(adminBot, "Perintah tidak dikenali atau tidak ada file/forward yang diproses.");
                }
            } else {
                tg.sendMessage(msg.chat.id, "Maaf, saya hanya merespons perintah dari admin.");
            }
        }
    } catch (error) {
        Logger.log("Error di doPost: " + error.message);
        Logger.log("Stack trace: " + error.stack);
        tg.sendMessage(adminBot, "Terjadi error: " + error.message);
    }
}

// --- Handler Commands dan Callbacks ---

function startCommand(msg) {
    let pesan = "Hai " + msg.from.first_name + " 👋! Hallo, Saya adalah Bot Bocchi!\n\n" +
                 "Kamu bisa ketik nama file atau deskripsi di chat ini (Khusus admin yang bisa).\n\n" +
                 "Atau, kamu bisa cari file secara *inline* dengan klik tombol di bawah ini:\n\n" +
                 "Ketik /help untuk bantuan. 😜";

    let keyboard = [
        [{ text: "Cari 🔍", switch_inline_query_current_chat: "" }],
        [{ text: "Bagikan 👉👈", callback_data: "share" }], // Callback data untuk share
        // Hapus tombol Bantuan dari sini
    ];
    sendMsgKeyboardInline(msg, pesan, keyboard);
}

function handleHelpCommand(msg) {
    let pesan = "<b>Cara pakai gampang banget!</b>\n\n" +
        "Buat nyari file, tinggal ketik di chat mana aja: <code>@Wispydream_bot [spasi] kata kunci</code>.  " +
        "Nanti muncul deh pilihan file-nya.  Tinggal klik, beres!\n\n" +
        "Contoh: <code>@Wispydream_bot laporan</code>  (buat nyari file yang namanya atau deskripsinya ada kata 'laporan').";

        tg.sendMessage(msg.chat.id, pesan, "HTML");

}

function handleInlineQuery(inlineQuery) {
    try {
        let query = inlineQuery.query;
        let offset = inlineQuery.offset;
        Logger.log("handleInlineQuery - Query: " + query + ", Offset: " + offset);

        let results = searchFiles(query, offset, 50);
        Logger.log("handleInlineQuery - Hasil: " + JSON.stringify(results));

        let numResults = results.length;
        let switchPmText;

        if (query.trim() === "" || numResults === 0) {
            if (query.trim() === "") {
                switchPmText = "Silahkan ketik untuk mencari...";
            } else {
                switchPmText = "0 Results for '" + query + "'";
            }
        } else {
             // MODIFIKASI DI SINI:
            if (numResults >= 50) {
                switchPmText = "50+ Results for '" + query + "'"; // Tampilkan "50+"
            } else {
                switchPmText = numResults + " Results for '" + query + "'"; // Tampilkan angka pasti
            }
        }

        // Perhitungan nextOffset yang BENAR untuk infinite scrolling:
        let nextOffset = (parseInt(offset, 10) || 0) + results.length;
        nextOffset = results.length < 50 ? "" : String(nextOffset); // Kosongkan jika kurang dari limit

        let response = {
            inline_query_id: inlineQuery.id,
            results: JSON.stringify(results),
            cache_time: 600,
            switch_pm_text: switchPmText,
            switch_pm_parameter: "start",
            next_offset: nextOffset,
        };

        Logger.log("Response Answer Inline Query: " + JSON.stringify(response));
        tg.request("answerInlineQuery", response);

    } catch (error) {
        Logger.log("Error di handleInlineQuery: " + error.message);
        tg.sendMessage(adminBot, "Error di handleInlineQuery: " + error.message);
    }
}

function handleCallbackQuery(callbackQuery) {
    try {
        let data = callbackQuery.data;
        let cb = callbackQuery;
        Logger.log("handleCallbackQuery - Data: " + data);

        if (data === "share") {
          let pesan = "Bagikan bot ini ke teman-temanmu!\n\nhttps://t.me/Wispydream_bot";
            sendMsgKeyboardInline2(cb, pesan, []); // Atau pakai sendMsgKeyboardInline jika mau
        }

        tg.answerCallbackQuery(callbackQuery.id, "Perintah diterima!");
    }   catch (error) {
        Logger.log("Error di handleCallbackQuery: " + error.message);
        Logger.log("Stack trace: " + error.stack);
        tg.sendMessage(adminBot, "Terjadi error: " + error.message);
    }
}

// --- Fungsi Penyimpanan Data ---
function saveForwardedMessage(msg) {
    try {
        let fileId, fileName, fileType, caption, uploadedBy, messageLink;

        // Mendapatkan link pesan
        if (msg.forward_from_chat && msg.forward_from_chat.username) {
            messageLink = "https://t.me/" + msg.forward_from_chat.username + "/" + msg.forward_from_message_id;
        } else if (msg.forward_from_chat) {
            messageLink = "private chat/channel";
        } else if (msg.forward_sender_name) {
            messageLink = "forwarded from " + msg.forward_sender_name;
        } else {
            messageLink = "Unknown";
        }

        uploadedBy = msg.from.id;
        caption = msg.caption ? msg.caption : "";

        if (msg.photo) {
            let photo = msg.photo[msg.photo.length - 1];
            fileId = photo.file_id;
            fileName = "photo_" + fileId + ".jpg";
            fileType = "photo";
        } else if (msg.document) {
            fileId = msg.document.file_id;
            fileName = msg.document.file_name;
            fileType = "document";
        }

        Logger.log("saveForwardedMessage - File: " + fileName + ", Type: " + fileType + ", fileId: " + fileId);

        let sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
        sheet.appendRow([fileId, fileName, fileType, caption, uploadedBy, messageLink]);

        tg.sendMessage(adminBot, `File ${fileName} tersimpan!`);

    } catch (error) {
        Logger.log("Error di saveForwardedMessage: " + error.message);
        Logger.log("Stack trace: " + error.stack);
        tg.sendMessage(adminBot, "Error saat menyimpan file: " + error.message);
    }
}
