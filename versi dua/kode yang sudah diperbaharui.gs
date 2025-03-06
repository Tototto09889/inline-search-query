const telegramAPIToken = "7680446501:AAFwSWuv8tdDHdpm35KEH5O-aDvWFEiqRd0"; // [GANTI] - Hapus 'XX' di akhir
const telegramAPIURL = "https://api.telegram.org/bot" + telegramAPIToken;
const telegramAdminID = "2109541199";
const googleWebAppsURL = "ganti"; // [GANTI] - Hapus 'XXX' di akhir
const googleSheetID = "10uM3IVAmewTIfYiUOx_YKAugjUm1HF3a9cWTYWPYcM8";
const googleSheetFile = SpreadsheetApp.openById(googleSheetID);
const googleSheetName = "DataFile";

const scriptProperties = PropertiesService.getScriptProperties();

// --- Fungsi untuk menyimpan dan mengambil lastProcessedMessageId dan channelId ---
function getLastProcessedMessageId() {
    return parseInt(scriptProperties.getProperty('lastProcessedMessageId')) || 0;
}

function setLastProcessedMessageId(messageId) {
    scriptProperties.setProperty('lastProcessedMessageId', String(messageId));
}

function getChannelId() {
    return scriptProperties.getProperty('channelId');
}

function setChannelId(channelId) {
    scriptProperties.setProperty('channelId', String(channelId));
}

function deleteChannelId() {
    scriptProperties.deleteProperty('channelId');
}

// --- Fungsi getChannelMessages (Modifikasi) ---
function getChannelMessages(channelChatId, maxMessages = 50, timeLimit = 240) {
    let lastProcessedId = getLastProcessedMessageId();
    let newLastProcessedId = lastProcessedId;
    let offset = 0;
    let limit = 100;
    let allMessages = [];
    let keepFetching = true;
    let startTime = Date.now();
    let processedCount = 0;

    while (keepFetching) {
        let url = `${telegramAPIURL}/getUpdates?offset=${offset}&limit=${limit}&allowed_updates=["message"]`;
        let response;
        try {
            response = UrlFetchApp.fetch(url);
        } catch (error) {
            Logger.log("Error fetching updates: " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat mengambil update dari Telegram: " + error);
            return { messages: [], isFinished: false };
        }
        let json = JSON.parse(response.getContentText());

        if (json.ok && json.result.length > 0) {
            let updates = json.result;
            for (let update of updates) {
                if (update.message && update.message.chat.id == channelChatId) {
                    if (update.message.message_id > lastProcessedId) {
                        allMessages.push(update.message);
                        newLastProcessedId = Math.max(newLastProcessedId, update.message.message_id);
                        processedCount++;
                    }
                }
                offset = update.update_id + 1;

                if (processedCount >= maxMessages || (Date.now() - startTime) / 1000 >= timeLimit) {
                    keepFetching = false;
                    break;
                }
            }
        } else {
            keepFetching = false;
        }
        Utilities.sleep(1000); // Jeda 1 detik
    }

    setLastProcessedMessageId(newLastProcessedId);
    return { messages: allMessages, isFinished: keepFetching === false && processedCount < maxMessages };
}

// --- Fungsi untuk memproses pesan channel (dipanggil oleh trigger) ---
function processChannelMessages() {
    // Ambil channelId dari PropertiesService
    const channelId = getChannelId();

    if (!channelId) {
        Logger.log("Channel ID tidak ditemukan. Pastikan admin sudah menjalankan /startchannel.");
        return; // Hentikan jika channelId tidak ada
    }

    let fileCounter = 0;
    let result = getChannelMessages(channelId);
    let messages = result.messages;
    let isFinished = result.isFinished;

    for (let message of messages) {
        // Data umum untuk pesan channel
        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: (message.from.username || ""),
            first_name: message.from.first_name || "",
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title || "",
            source: "channel"
        };

        // Handle file
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name || `document_${message.message_id}`; //Nama default
            dataToStore.caption = message.caption || "Tidak ada Caption"; //Caption default
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileType = "photo";
            fileName = `photo_${message.message_id}`; // Nama default
            dataToStore.caption = message.caption || "Tidak ada Caption"; //Caption default
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name || `video_${message.message_id}`; //Nama default
            dataToStore.caption = message.caption || "Tidak ada Caption"; //Caption default
        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name || `audio_${message.message_id}`; //Nama default
            dataToStore.caption = message.caption || "Tidak ada Caption"; //Caption default
        } else {
            continue; // Lewati pesan yang bukan file
        }

        dataToStore.file_id = fileId;
        dataToStore.file_type = fileType;
        dataToStore.file_name = fileName;


        try {
            let resultMessage = simpanSheets(dataToStore);
            fileCounter++;
        } catch (error) {
            Logger.log("Error saving to sheet: " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat menyimpan ke Google Sheet: " + error);
        }
    }

    // Kirim notifikasi ke admin jika selesai
    if (isFinished) {
        let channelTitle = messages[0]?.chat?.title || "Channel";
        kirimPesan(telegramAdminID, `Pemrosesan pesan di channel "${channelTitle}" selesai.  Total ${fileCounter} file disimpan.`);
        scriptProperties.deleteProperty('lastProcessedMessageId'); // Hapus lastProcessedMessageId, mulai dari awal lagi di trigger berikutnya
    }
}

// --- Fungsi setWebhook (Jalankan sekali) ---
function setWebhook() {
    let url = telegramAPIURL + "/setWebhook?url=" + googleWebAppsURL;
    let response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
}

// --- Fungsi deleteWebhook (Opsional) ---
function deleteWebhook() {
    let url = telegramAPIURL + "/deleteWebhook";
    let response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
}

// --- Fungsi Kirim Pesan ---
function kirimPesan(targetID, pesan, replymarkup) {
    let dataPesan = {
        method: "post",
        payload: {
            method: "sendMessage",
            parse_mode: "HTML",
            disable_web_page_preview: "true",
            chat_id: String(targetID),
            text: String(pesan),
            reply_markup: replymarkup
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", dataPesan);
}

// --- Fungsi untuk menyimpan data ke Google Sheet ---
function simpanSheets(objectData) {
    try {
        let googleSheetData = googleSheetFile.getSheetByName(googleSheetName) || googleSheetFile.insertSheet(googleSheetName);
        let headers = googleSheetData.getRange(1, 1, 1, Object.keys(objectData).length).getValues()[0];

        for (let i = 0; i < Object.keys(objectData).length; i++) {
            if (headers[i] !== Object.keys(objectData)[i]) {
                googleSheetData.getRange(1, i + 1).setValue(Object.keys(objectData)[i]);
            }
        }
        googleSheetData.appendRow(Object.values(objectData));
        return "Data berhasil disimpan!";

    } catch (e) {
        return "Terjadi kesalahan saat menyimpan data: " + e;
    }
}

// --- Fungsi untuk membuat/menghapus trigger waktu ---
function createTimeDrivenTrigger() {
    // Hapus trigger yang ada
    let triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'processChannelMessages') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }

    // Buat trigger baru
    ScriptApp.newTrigger('processChannelMessages')
        .timeBased()
        .everyMinutes(5) // Sesuaikan interval
        .create();
}

function deleteTimeDrivenTrigger() {
    // Hapus trigger yang ada
    let triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'processChannelMessages') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }
}

// --- Fungsi untuk menjawab inline query ---
function answerInlineQuery(inlineQueryId, results, nextOffset) {
    let data = {
        method: "post",
        payload: {
            method: "answerInlineQuery",
            inline_query_id: String(inlineQueryId),
            results: JSON.stringify(results),
            cache_time: 60, // Tingkatkan cache_time
            is_personal: true,
            next_offset: String(nextOffset)
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

// --- Fungsi untuk menangani inline query ---
function handleInlineQuery(inlineQuery) {
    let query = inlineQuery.query;
    let inlineQueryId = inlineQuery.id;
    let offset = parseInt(inlineQuery.offset) || 0;

    let sheet = googleSheetFile.getSheetByName(googleSheetName);
    let lastRow = sheet.getLastRow();
    let results = [];
    let nextOffset = "";

    if (query.length === 0) { // Placeholder
        let placeholderResult = [{
            type: "article",
            id: "placeholder",
            title: "Silakan ketik untuk mencari...",
            input_message_content: {
                message_text: "Silakan mulai ketik untuk mencari file."
            }
        }];
        answerInlineQuery(inlineQueryId, placeholderResult, "");
        return;
    }

    if (query.length < 3) { // Minimal 3 karakter
        answerInlineQuery(inlineQueryId, [], "");
        return;
    }


    if (offset < lastRow - 1) {
        let numRowsToRead = 50;
        let startRow = offset + 1;
        if(startRow < 1) startRow = 1;

        let data = sheet.getRange(startRow + 1, 1, numRowsToRead, sheet.getLastColumn()).getValues();
        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        let foundCount = 0;

        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            let rowData = {};
            for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = row[j];
            }

            if (Object.values(rowData).some(value => String(value).toLowerCase().includes(query.toLowerCase()))) {
                let fileId = rowData.file_id;
                if (fileId) {
                    let result = {
                        type: "document",
                        id: String(offset + i + 1),
                        title: rowData.file_name || "File",
                        document_file_id: fileId,
                        caption: `File Name: ${rowData.file_name || 'Tidak Ada Nama'}\nCaption: ${rowData.caption || 'Tidak Ada Caption'}\nSource: ${rowData.source || 'Tidak Diketahui'}`
                    };
                    results.push(result);
                    foundCount++;
                }
            }
        }
         nextOffset = String(offset + results.length);
    }

    // Tampilkan jumlah hasil
    let resultMessage = "";
     if (results.length > 0) {
        let totalFound = offset > 0 ? lastRow - 1 : foundCount;
        if (totalFound > 50) {
            resultMessage = `Ada 50+ hasil untuk '${query}'`;
        } else {
            resultMessage = `Ada ${totalFound} hasil untuk '${query}'`;
        }
    } else {
        if(offset == 0){
             resultMessage = `Tidak ada hasil untuk '${query}'`;
        }
    }

    if (resultMessage) {
        let messageResult = [{
            type: "article",
            id: "info",
            title: resultMessage,
            input_message_content: {
                message_text: resultMessage
            }
        }];
        results = messageResult.concat(results);
    }

    answerInlineQuery(inlineQueryId, results, nextOffset);
}

// --- doPost (Untuk Forward Pesan, Upload, /start, /startchannel, /stopchannel, dan Inline Query) ---
function doPost(e) {
    let update = JSON.parse(e.postData.contents);

    // --- Handle Inline Query ---
    if (update.inline_query) {
        handleInlineQuery(update.inline_query);
        return; // Hentikan eksekusi setelah menangani inline query
    }

    // --- Handle Pesan dari Admin ---
    if (update.message && update.message.from.id == telegramAdminID) {
        let message = update.message;

        // Handle command /startchannel
        if (message.text && message.text.toLowerCase() === "/startchannel") {
            // Ambil ID chat dari pesan (ini akan jadi ID channel yang dipantau)
            let channelId = message.chat.id;

            // Simpan channelId ke PropertiesService
            setChannelId(channelId);

            // Buat trigger waktu
            createTimeDrivenTrigger();

            kirimPesan(telegramAdminID, "Pemantauan channel dimulai. Trigger waktu telah diaktifkan.");
            return; // Penting!
        }

        //Handle command /stopchannel
        if (message.text && message.text.toLowerCase() === "/stopchannel") {
            deleteTimeDrivenTrigger();
            deleteChannelId();
            kirimPesan(telegramAdminID, "Pemantauan channel dihentikan. Trigger waktu telah dinonaktifkan.");
            return;
        }


        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: (message.from.username || ""),
            first_name: message.from.first_name || "",
            chat_id: message.chat.id,
            source: "forwarded"
        };

        // Handle forward
        if (message.forward_from || message.forward_from_chat) {
            dataToStore.forwarded_from_id = (message.forward_from ? message.forward_from.id : message.forward_from_chat.id);
            dataToStore.forwarded_from_username = (message.forward_from ? (message.forward_from.username || "") : (message.forward_from_chat.username || ""));
            dataToStore.forwarded_from_name = message.forward_from ? message.forward_from.first_name : message.forward_from_chat.title;
            dataToStore.forwarded_message_id = message.forward_from_message_id;
            dataToStore.caption = (message.caption || "");
            dataToStore.is_forwarded = true; // Tandai bahwa ini di-forward
            dataToStore.chat_type = message.forward_from_chat.type; // "private", "group", "supergroup", "channel"
              if(message.forward_from_chat.type != "private"){
                dataToStore.chat_id_forwarded = message.forward_from_chat.id; // Simpan ID chat asal (jika bukan private)
                dataToStore.chat_title = message.forward_from_chat.title; // Simpan judul chat asal
              }
        }

        // Handle file.  Kode ini *hanya* memproses jika ada file.
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name || `document_${message.message_id}`; // Nama default
            dataToStore.caption = message.caption || "Tidak ada caption"; // Caption default
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileType = "photo";
            fileName =  `photo_${message.message_id}`; // Nama default
            dataToStore.caption = message.caption || "Tidak ada caption"; // Caption default
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name || `video_${message.message_id}`; // Nama default
            dataToStore.caption = message.caption || "Tidak ada caption"; // Caption default

        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name || `audio_${message.message_id}`; // Nama default
            dataToStore.caption = message.caption || "Tidak ada caption";  // Caption default

        } else if (message.text){
            // Handle command /start (hanya untuk admin)
            if (message.text == "/start") {
                kirimPesan(message.chat.id, "Selamat datang Admin. Silahkan forward file untuk disimpan, atau tambahkan bot ini ke channel sebagai admin dan jalankan /startchannel.");
                return;
            } else {
                //Selain command, tidak direspon.
                return;
            }
        }

        else {
            // Jenis pesan tidak didukung (selain file dan /start)
            // kirimPesan(telegramAdminID, "Jenis pesan ini tidak didukung untuk disimpan."); //Tidak perlu, karena hanya memproses file
            return;
        }

        dataToStore.file_id = fileId;
        dataToStore.file_type = fileType;
        dataToStore.file_name = fileName;

        try {
            let resultMessage = simpanSheets(dataToStore);
            kirimPesan(telegramAdminID, resultMessage);
        } catch (error) {
            Logger.log("Error saving to sheet (forwarded/uploaded message): " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat menyimpan file yang di-forward/upload: " + error);
        }
    } //end handle admin
} //end doPost

