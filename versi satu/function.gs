// --- Fungsi Pencarian (searchFiles) ---
// function.gs

function searchFiles(query, offset, limit = 50) {
    try {
        Logger.log("searchFiles - Query: " + query + ", Offset: " + offset + ", Limit: " + limit);

        let dataSheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Data"); // Sheet data utama
        let indexSheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName("Indeks"); // Sheet indeks

        let indexData = indexSheet.getDataRange().getValues();
        let results = [];
        let usedIds = {};
        let offsetNum = parseInt(offset, 10) || 0;
        let startIndex = offsetNum;
        let queryLower = query.toLowerCase();
        let rowNumbers = [];
        let explicitExtension = "";

        // Cek apakah pengguna menyertakan ekstensi secara eksplisit
        let match = queryLower.match(/\.(mp4|webm|ogg|mov|avi|mkv|3gp|3g2|mp3|aac|wav|flac|wma|pdf|docx|xlsx|pptx|txt|jpg|jpeg|png|gif)$/); // Tambahkan ekstensi lain jika perlu
        if (match) {
            explicitExtension = match[1]; // Ambil ekstensi (tanpa titik)
            queryLower = queryLower.replace(/\.[^.]+$/, ""); // Hapus ekstensi dari query
            queryLower = queryLower.trim()
        }


        // 1. Cari di indeks
       for (let i = 1; i < indexData.length; i++) { // Mulai dari 1 (lewati header)
            if (indexData[i][0].toLowerCase().includes(queryLower)) {
               // Pisahkan string baris menjadi array angka
                let rows = indexData[i][1].split(",").map(Number).filter(n => n > 0); // Pastikan > 0
                rowNumbers = rowNumbers.concat(rows);

            }
        }

        // Urutkan dan ambil yang unik
        rowNumbers = [...new Set(rowNumbers.sort((a,b) => a - b))];



        // 2. Ambil data dari baris yang relevan, dengan offset dan limit
       let data = dataSheet.getDataRange().getValues();
        for (let j = startIndex; j < rowNumbers.length && results.length < limit ; j++) {
              let rowIndex = rowNumbers[j];
              if(!rowIndex) continue;

            let row = data[rowIndex-1];
            if(!row) continue;

            let fileId = row[0];
            let fileName = row[1];
            let fileType = row[2];
            let caption = row[3];
            let messageLink = row[5];


            // Validasi fileId
            if (!fileId || typeof fileId !== 'string') {
                Logger.log("WARNING: fileId tidak valid untuk baris " + rowIndex);
                continue;
            }

             // Cek ekstensi (jika ada pencarian eksplisit)
            if (explicitExtension && !fileName.toLowerCase().endsWith("." + explicitExtension)) {
                continue; // Lewati file ini jika ekstensinya tidak cocok
            }


            let id = fileId;
            let counter = 1;
            while (usedIds[id]) {
                id = fileId + "_" + counter;
                counter++;
            }
            usedIds[id] = true;
            id = id.substring(0, 64);


            let finalCaption = (caption && caption.trim() !== "") ? caption + "\n\nIni dia filenya 😝" : "Ini dia filenya 😝";
            let shortCaption = finalCaption.length > 200 ? finalCaption.substring(0, 200) + "..." : finalCaption;
            let inlineKeyboard = [[{ text: "Cari", switch_inline_query_current_chat: "" }]];

            let result;
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
            } else if (fileType == "document" || fileType == "video" || fileType == "audio" || fileType == "animation") {
                result = {
                    type: "document", // Selalu gunakan "document" untuk inline query
                    id: id,
                    document_file_id: fileId, // Gunakan document_file_id
                    title: fileName,
                    caption: shortCaption,
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: inlineKeyboard },
                };
            }

            if (result) {
                results.push(result);
            }
        }
        Logger.log("Hasil pencarian (searchFiles): " + JSON.stringify(results));

        return results;

    } catch (error) {
        Logger.log("Error di searchFiles: " + error.message + ", Stack: " + error.stack);
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

