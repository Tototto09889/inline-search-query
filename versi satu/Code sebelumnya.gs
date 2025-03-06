Ini adalah bot telegram dengan google sheet dan script
Ini code.gs
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
Ini function.gs
// --- Fungsi Pencarian (searchFiles) ---
function searchFiles(query, offset, limit = 50) {
    try {
        Logger.log("searchFiles dijalankan!");
        Logger.log("Query yang diterima: " + query);
        Logger.log("Limit hasil: " + limit);
        Logger.log("Offset: " + offset);

        let sheet = SpreadsheetApp.openById(spreadsheetId).getActiveSheet();
        let data = sheet.getDataRange().getValues();
        Logger.log("Jumlah baris data: " + data.length);

        let results = [];
        let usedIds = {};

        let offsetNum = parseInt(offset, 10) || 0;
        // Mulai iterasi dari offsetNum + 1 (karena header)
        let startIndex = offsetNum + 1;

        for (let i = startIndex; i < data.length; i++) { // Mulai dari startIndex
            let fileId = data[i][0];
            let fileName = data[i][1];
            let fileType = data[i][2];
            let caption = data[i][3];
            let messageLink = data[i][5];

            // Logger.log("Memproses baris: " + (i + 1) + ", fileId: " + fileId + ", fileName: " + fileName); // Debugging (opsional)

            if (!fileId || typeof fileId !== 'string') {
                Logger.log("WARNING: fileId tidak valid untuk baris " + (i + 1));
                continue;
            }

            let id = fileId;
            let counter = 1;
            while (usedIds[id]) {
                id = fileId + "_" + counter;
                counter++;
                Logger.log("WARNING: Duplikat fileId ditemukan. Menggunakan: " + id);
            }
            usedIds[id] = true;
            id = id.substring(0, 64);

            let queryLower = query ? query.toLowerCase() : "";
            let fileNameLower = fileName ? fileName.toLowerCase() : "";
            let captionLower = caption ? caption.toLowerCase() : "";

            if (fileNameLower.includes(queryLower) || captionLower.includes(queryLower)) {
                // TIDAK perlu lagi melewati secara manual, kita sudah mulai dari startIndex
                let result;

                // Buat caption akhir
                let finalCaption;
                if (caption && caption.trim() !== "") {
                    finalCaption = caption + "\n\nIni dia filenya 😝";
                } else {
                    finalCaption = "Ini dia filenya 😝";
                }

                let shortCaption = finalCaption.length > 200 ? finalCaption.substring(0,200) + "..." : finalCaption;


                // Buat keyboard inline untuk tombol "Cari"
                let inlineKeyboard = [
                    [{ text: "Cari", switch_inline_query_current_chat: "" }],
                ];

                if (fileType == "photo") {
                    result = {
                        type: "photo",
                        id: id,
                        photo_file_id: fileId,
                        title: fileName,
                        caption: shortCaption,
                        parse_mode: "HTML",
                        reply_markup: { inline_keyboard: inlineKeyboard },
                    };
                } else if (fileType == "document") {
                    result = {
                        type: "document",
                        id: id,
                        document_file_id: fileId,
                        title: fileName,
                        caption: shortCaption,
                        parse_mode: "HTML",
                        thumb_url: "",
                        thumb_width: 50,
                        thumb_height: 50,
                        reply_markup: { inline_keyboard: inlineKeyboard },
                    };
                }

                if (result) {
                    results.push(result);
                    if (results.length >= limit) {
                        Logger.log("Mencapai limit. Berhenti.");
                        break;
                    }
                }
            }
        }


        Logger.log("Hasil pencarian: " + JSON.stringify(results));
        return results;

    } catch (error) {
        Logger.log("Error di searchFiles: " + error.message);
        return [];
    }
}

// --- Fungsi-fungsi Telegram Lainnya (Tidak Berubah) ---

//inline keyboard v1
function sendMsgKeyboardInline(msg, pesan, keyboard) {
  let data = {
    chat_id: msg.chat.id,
    text: pesan,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  }
  let r = tg.request('sendMessage', data);
  return r;
}

//inline keyboard v2 bisa reply message
function sendMsgKeyboardInline1(msg, pesan, keyboard) {
  let msg_id = msg.message_id;
  let data = {
    chat_id: msg.chat.id,
    text: pesan,
    parse_mode: 'HTML',
    reply_to_message_id: msg_id,
    reply_markup: {
      inline_keyboard: keyboard
    }
  }
  let r = tg.request('sendMessage', data);
  return r;
}

//inline keyboard v3 buat callback
function sendMsgKeyboardInline2(cb, pesan, keyboard) {
  let data = {
    chat_id: cb.message.chat.id,
    text: pesan,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: keyboard,
    }
  }
  let r = tg.request('sendMessage', data);
  return r;
}

// bot akan mengirim foto yang diisi caption + bonus inline keyboard
function kirimPesanX(msg, url_foto, caption, keyboard) {
  // bot akan mereply pesan dari user
  let msg_id = msg.message_id;
  //fetch data 
  let data = {
    chat_id: msg.chat.id,
    photo: url_foto,
    caption: caption,
    parse_mode: 'HTML',
    reply_to_message_id: msg_id,
    reply_markup: {
      inline_keyboard: keyboard
    }
  }
  //bot mengirim pesan kirim
  return tg.request('sendPhoto', data);
}

function kirimPesanX1(msg, url_foto, caption, keyboard) {
  let data = {
    chat_id: msg.chat.id,
    photo: url_foto,
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard,
      selective: true,
    }
  }
  //bot mengirim pesan kirim
  return tg.request('sendPhoto', data);
}

// callback keyboard khusus kirim foto
function callbackKeyboard(cb, url_foto, caption, keyboard) {
  let data = {
    chat_id: cb.message.chat.id,
    photo: url_foto,
    caption: caption,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  }
  //bot mengirim pesan kirim
  return tg.request('sendPhoto', data);
}

//reply message backup klo gk bisa
function sendMsgkawan(msg, pesan) {

  //inisiasi awal message id yg akan direply
  let msg_id = msg.message_id;

  //jika pesannya mereply pesan lain, message idnya akan diupdate
  if (msg.reply_to_message) {
    msg_id = msg.reply_to_message.message_id;
  }

  //data yang akan dikirim
  let data = {
    chat_id: msg.chat.id,
    text: pesan,
    reply_to_message_id: msg_id,
  }
  let r = tg.request('sendMessage', data);
  return r;
}

//inline button v1 biasa
function sendMsgKeyboard(msg, pesan, keyboard) {
    let data = {
        chat_id: msg.chat.id,
        text: pesan,
        parse_mode: 'HTML',
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: true,
            selective: true,
            keyboard: keyboard
        }
    }
    let r = tg.request('sendMessage', data);
    return r;
}

//inline button v2 reply message
function sendMsgKeyboard1(msg, pesan, keyboard) {
    //bot reply pesanmu
    let msg_id = msg.message_id;
    let data = {
        chat_id: msg.chat.id,
        text: pesan,
        parse_mode: 'HTML',
        reply_to_message_id: msg_id,
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: true,
            selective: true,
            keyboard: keyboard,
        }
    }
    let r = tg.request('sendMessage', data);
    return r;
}

//inline button v3 buat callback
function sendMsgKeyboard2(cb, pesan, keyboard) {
    let data = {
        chat_id: cb.message.chat.id,
        text: pesan,
        parse_mode: 'HTML',
        reply_markup: {
            resize_keyboard: true,
            one_time_keyboard: true,
            keyboard: keyboard,
        }
    }
    let r = tg.request('sendMessage', data);
    return r;
}

function removeKeyboard(msg, pesan) {
    let msg_id = msg.message_id;
    let data = {
        chat_id: msg.chat.id,
        text: pesan,
        parse_mode: 'HTML',
        reply_to_message_id: msg_id,
        reply_markup: {
            remove_keyboard: true
        }
    }
    let r = tg.request('sendMessage', data);
    return r;
}

//cara make keyboard button contoh

//if ( /^\/start$/i.exec(msg.text) ){

//    // pesan buat dikirim
//    let pesan = "Halo, saya bot.\n\nSilakan pilih menu keyboard ini ya";

//    // buat 1 keyboard, berisi perintah /ping
//    let keyboard = [ 
//                ['/ping']
//           ]

//    // panggil fungsi sendMsgKeyboard yang dibuat sebelumnya
//    return sendMsgKeyboard1(msg.chat.id, pesan, keyboard);
//}

//batasi akses
// sesuaikan user ID / chat ID yang akan dilimit. Ini hanya contoh saja.
var punyaAkses = [-1001519861998, 2109541199, 1104560929];
function diizinkan(id) {
    if (punyaAkses.indexOf(id) > -1) {
        return true;
    } else {
        return false;
    }
}

//untuk tes apakah berfungsi
function sendPhoto() {
    var data = {
        chat_id: 2109541199,
        photo: UrlFetchApp.getRequest,
        caption: 'Ini data Foto yang dikirim via URL'
    };
    return tg.request('sendPhoto', data);
}


Nah coba berikan kode khusus untuk inline search query dan forward pesan dan upload dari adminnya
