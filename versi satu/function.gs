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

