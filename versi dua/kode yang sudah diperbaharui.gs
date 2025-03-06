const telegramAPIToken = "GANTI_DENGAN_API_TOKEN_BOT_ANDA"; // GANTI
const telegramAPIURL = "https://api.telegram.org/bot" + telegramAPIToken;
const telegramAdminID = "GANTI_DENGAN_ID_USER_ADMIN_BOT_ANDA"; // GANTI
const googleWebAppsURL = "GANTI_DENGAN_URL_WEB_APPS_ANDA";   // GANTI
const googleSheetID = "GANTI_DENGAN_GOOGLE_SHEETS_ID_ANDA";     // GANTI
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

// --- Fungsi getChannelMessages (DIPERBAIKI dan Disederhanakan) ---
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
        // PERBAIKAN: Pastikan tidak ada spasi di allowed_updates!
        let url = `${telegramAPIURL}/getUpdates?offset=${offset}&limit=${limit}&allowed_updates=["message"]`;
        Logger.log("URL getUpdates: " + url); // Log URL untuk verifikasi

        let response;
        try {
            response = UrlFetchApp.fetch(url);
        } catch (error) {
            Logger.log("Error fetching updates: " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat mengambil update dari Telegram: " + error);
            return { messages: [], isFinished: false };
        }

        let json;
        try { // Tambahkan error handling untuk parsing JSON
            json = JSON.parse(response.getContentText());
        } catch (parseError) {
            Logger.log("Error parsing JSON from getUpdates: " + parseError);
            Logger.log("Response content: " + response.getContentText()); // Log respons mentah
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat memproses respons dari Telegram (parsing JSON): " + parseError);
            return { messages: [], isFinished: false };
        }
        Logger.log("Response dari getUpdates (JSON): " + JSON.stringify(json)); // Log respons yang sudah di-parse


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
                offset = update.update_id + 1; // Pindahkan ini ke luar if

                if (processedCount >= maxMessages || (Date.now() - startTime) / 1000 >= timeLimit) {
                    keepFetching = false;
                    break; // Hentikan jika mencapai batas
                }
            }
        } else {
            keepFetching = false; // Hentikan jika tidak ada update baru
        }
        Utilities.sleep(1000); // Jeda 1 detik (penting untuk menghindari rate limit)
    }

    setLastProcessedMessageId(newLastProcessedId); // Update lastProcessedMessageId
    return { messages: allMessages, isFinished: keepFetching === false };
}

// --- Fungsi untuk memproses pesan channel (dipanggil oleh trigger) ---
function processChannelMessages() {
    const channelId = getChannelId();

    if (!channelId) {
        Logger.log("Channel ID tidak ditemukan. Pastikan admin sudah menjalankan /startchannel.");
        return;
    }

    let fileCounter = 0;
    let result = getChannelMessages(channelId); // Panggil getChannelMessages
    let messages = result.messages;
    let isFinished = result.isFinished;

    Logger.log(`Ditemukan ${messages.length} pesan baru di channel.`);

    for (let message of messages) {
        // Data umum, berlaku untuk semua pesan
        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: message.from?.username || "", // Gunakan optional chaining
            first_name: message.from?.first_name || "", // Gunakan optional chaining
            chat_id: message.chat.id,
            chat_type: message.chat.type,
            chat_title: message.chat.title || "",
            source: "channel"
        };

        // Handle file (hanya jika ada file)
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name || `document_${message.message_id}`;
            dataToStore.caption = message.caption || "";
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id; // Ambil foto dengan resolusi tertinggi
            fileType = "photo";
            fileName = `photo_${message.message_id}`;
            dataToStore.caption = message.caption || "";
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name || `video_${message.message_id}`;
            dataToStore.caption = message.caption || "";
        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name || `audio_${message.message_id}`;
            dataToStore.caption = message.caption || "";
        } else {
            continue; // Lewati pesan yang bukan file
        }

        dataToStore.file_id = fileId;
        dataToStore.file_type = fileType;
        dataToStore.file_name = fileName;

        try {
            simpanSheets(dataToStore); // Simpan ke sheet
            fileCounter++;
        } catch (error) {
            Logger.log("Error saving to sheet: " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat menyimpan ke Google Sheet: " + error);
        }
    }

    // Kirim notifikasi ke admin jika selesai (dan hanya jika memang sudah selesai)
    if (isFinished) {
        // Dapatkan judul channel dari pesan pertama (jika ada)
        let channelTitle = messages.length > 0 ? messages[0].chat.title : "Channel";
        kirimPesan(telegramAdminID, `Pemrosesan pesan di channel "${channelTitle}" selesai. Total ${fileCounter} file disimpan.`);
        scriptProperties.deleteProperty('lastProcessedMessageId');
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

function kirimPesan(targetID, pesan, replymarkup = null) { // replymarkup opsional
    let dataPesan = {
        method: "post",
        payload: {
            method: "sendMessage",
            chat_id: String(targetID),
            text: String(pesan),
            parse_mode: "HTML",
            disable_web_page_preview: true, // Nonaktifkan preview link
            reply_markup: replymarkup // Sertakan reply_markup jika ada
        }
    };
    let response = UrlFetchApp.fetch(telegramAPIURL + "/", dataPesan);
    Logger.log("Response kirimPesan: " + response.getContentText()); // Log respons
}

// --- Fungsi untuk menyimpan data ke Google Sheet ---

function simpanSheets(objectData) {
    try {
        let googleSheetData = googleSheetFile.getSheetByName(googleSheetName) || googleSheetFile.insertSheet(googleSheetName);
        let headers = googleSheetData.getRange(1, 1, 1, Object.keys(objectData).length).getValues()[0];

        // Pastikan header ada
        for (let i = 0; i < Object.keys(objectData).length; i++) {
            if (headers[i] !== Object.keys(objectData)[i]) {
                googleSheetData.getRange(1, i + 1).setValue(Object.keys(objectData)[i]);
            }
        }

        googleSheetData.appendRow(Object.values(objectData));
        return "Data berhasil disimpan!";

    } catch (e) {
        return "Terjadi kesalahan: " + e;
    }
}

// --- Fungsi untuk membuat/menghapus trigger waktu ---

function createTimeDrivenTrigger() {
    // Hapus trigger lama (jika ada)
    let triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
        if (triggers[i].getHandlerFunction() === 'processChannelMessages') {
            ScriptApp.deleteTrigger(triggers[i]);
        }
    }

    // Buat trigger baru
    ScriptApp.newTrigger('processChannelMessages')
        .timeBased()
        .everyMinutes(5) // Jalankan setiap 5 menit
        .create();
}

function deleteTimeDrivenTrigger() {
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
            cache_time: 60,  // Cache selama 60 detik
            is_personal: true,
            next_offset: String(nextOffset)
        }
    };
    let response = UrlFetchApp.fetch(telegramAPIURL + "/", data);
    Logger.log("Response answerInlineQuery: " + response.getContentText()); // Log respons
}

// --- Fungsi untuk menangani inline query ---

function handleInlineQuery(inlineQuery) {
    Logger.log("handleInlineQuery dipanggil. Data inlineQuery:");
    Logger.log(JSON.stringify(inlineQuery));

    let query = inlineQuery.query;
    let inlineQueryId = inlineQuery.id;
    let offset = parseInt(inlineQuery.offset) || 0; // Offset, default 0

    let sheet = googleSheetFile.getSheetByName(googleSheetName);
    let lastRow = sheet.getLastRow();
    let results = [];
    let nextOffset = "";


    if (query.length === 0) { // Jika query kosong, tampilkan placeholder
        let placeholderResult = [{
            type: "article",
            id: "placeholder",
            title: "Silakan ketik untuk mencari...",
            input_message_content: { message_text: "Silakan mulai ketik untuk mencari file." }
        }];
        answerInlineQuery(inlineQueryId, placeholderResult, "");
        return;
    }

    if (query.length < 3) { // Minimal 3 karakter untuk pencarian
        answerInlineQuery(inlineQueryId, [], ""); // Kirim array kosong jika kurang dari 3 karakter
        return;
    }


    if (offset < lastRow - 1) { // Pastikan offset valid
        let numRowsToRead = 50; // Baca 50 baris per permintaan
        let startRow = offset + 2;
        if (startRow < 1) startRow = 2; // Mulai dari baris ke-2 (lewati header)

        let data = sheet.getRange(startRow, 1, numRowsToRead, sheet.getLastColumn()).getValues();
        let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        let foundCount = 0; // Hitung berapa banyak hasil yang ditemukan

        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            let rowData = {};

            // Buat objek dari baris
            for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = row[j];
            }

            // Periksa apakah query cocok dengan salah satu kolom
            if (Object.values(rowData).some(value => String(value).toLowerCase().includes(query.toLowerCase()))) {
                let fileId = rowData.file_id;
                if (fileId) { // Pastikan fileId ada
                    let result = {
                        type: "document",
                        id: String(offset + i + 1),
                        title: rowData.file_name || "File", // Judul dari nama file
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


    // Tampilkan pesan informasi jumlah hasil (jika ada)
      let resultMessage = "";
    if (results.length > 0) {
        let totalFound = offset > 0 ? lastRow - 1: foundCount;
        if(totalFound > 50){
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
            id: "info", // ID unik
            title: resultMessage,
            input_message_content: { message_text: resultMessage }
        }];
        results = messageResult.concat(results); // Gabungkan dengan hasil pencarian
    }
    answerInlineQuery(inlineQueryId, results, nextOffset);
}

// --- doPost (Fungsi Utama) ---

function doPost(e) {
    Logger.log("doPost dipanggil. Data e:");
    Logger.log(JSON.stringify(e)); // Log seluruh data yang diterima

    let update;
    try {
        update = JSON.parse(e.postData.contents);
    } catch (error) {
        Logger.log("Error parsing JSON in doPost: " + error);
        kirimPesan(telegramAdminID, "Terjadi kesalahan saat memproses data dari Telegram (parsing JSON): " + error);
        return;
    }

    // --- Handle Inline Query ---
    if (update.inline_query) {
        handleInlineQuery(update.inline_query);
        return; // Selesai memproses inline query
    }

    // --- Handle Pesan dari Admin ---
    if (update.message && update.message.from.id == telegramAdminID) {
        let message = update.message;

        // Handle command /startchannel (di private chat dengan bot)
        if (message.text && message.text.toLowerCase() === "/startchannel") {
            let channelId = message.chat.id; // Ini akan menjadi ID channel jika dijalankan di dalam channel
            setChannelId(channelId);
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
          //Handle command /start
        if (message.text && message.text.toLowerCase() === "/start"){
             kirimPesan(telegramAdminID, "Selamat Datang Admin, bot siap digunakan. Silahkan jalankan /startchannel di channel yang ingin di pantau. Atau forward pesan yang ingin disimpan filenya.");
             return;
        }


        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: (message.from.username || ""),
            first_name: message.from.first_name || "",
            chat_id: message.chat.id,
            source: "forwarded"  // Tandai sumber sebagai "forwarded"
        };

        // Handle forward (informasi dari pesan yang di-forward)
        if (message.forward_from || message.forward_from_chat) {
            dataToStore.forwarded_from_id = (message.forward_from ? message.forward_from.id : message.forward_from_chat.id);
            dataToStore.forwarded_from_username = (message.forward_from ? (message.forward_from.username || "") : (message.forward_from_chat.username || ""));
            dataToStore.forwarded_from_name = message.forward_from ? message.forward_from.first_name : message.forward_from_chat.title;
            dataToStore.forwarded_message_id = message.forward_from_message_id;
            dataToStore.caption = message.caption || ""; // Caption dari pesan yang di-forward
            dataToStore.is_forwarded = true;
            dataToStore.chat_type = message.forward_from_chat.type;
            if(message.forward_from_chat.type != "private"){
                dataToStore.chat_id_forwarded = message.forward_from_chat.id;
                dataToStore.chat_title = message.forward_from_chat.title;
            }

        }

        // Handle file (hanya jika ada file)
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name || `document_${message.message_id}`;
            dataToStore.caption = message.caption || "Tidak ada caption";
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileType = "photo";
            fileName = `photo_${message.message_id}`;
            dataToStore.caption = message.caption || "Tidak ada caption";
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name || `video_${message.message_id}`;
            dataToStore.caption = message.caption || "Tidak ada caption";
        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name || `audio_${message.message_id}`;
            dataToStore.caption = message.caption || "Tidak ada caption";
        } else {
            // Jika bukan file atau command yang valid, abaikan
            return;
        }

        dataToStore.file_id = fileId;
        dataToStore.file_type = fileType;
        dataToStore.file_name = fileName;

        try {
            simpanSheets(dataToStore);
            kirimPesan(telegramAdminID, "File berhasil disimpan!"); // Konfirmasi ke admin
        } catch (error) {
            Logger.log("Error saving to sheet (forwarded/uploaded message): " + error);
            kirimPesan(telegramAdminID, "Terjadi kesalahan saat menyimpan file: " + error);
        }
    }
}

