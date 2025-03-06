const telegramAPIToken = "GANTI_DENGAN_API_TOKEN_BOT_ANDA";
const telegramAPIURL = "https://api.telegram.org/bot" + telegramAPIToken;
const telegramAdminID = "GANTI_DENGAN_ID_USER_ADMIN_BOT_ANDA";
const googleWebAppsURL = "GANTI_DENGAN_URL_WEB_APPS_ANDA";
const googleSheetID = "GANTI_DENGAN_GOOGLE_SHEETS_ID_ANDA";
const googleSheetFile = SpreadsheetApp.openById(googleSheetID);
const googleSheetName = "DataFile";

const scriptProperties = PropertiesService.getScriptProperties();

// --- Fungsi untuk menyimpan dan mengambil lastProcessedMessageId ---
function getLastProcessedMessageId() {
    return parseInt(scriptProperties.getProperty('lastProcessedMessageId')) || 0;
}

function setLastProcessedMessageId(messageId) {
    scriptProperties.setProperty('lastProcessedMessageId', String(messageId));
}

// --- Fungsi getChannelMessages (Dimodifikasi) ---
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
    const channelId = "GANTI_DENGAN_ID_CHANNEL_ANDA";
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
            source: "channel" // Tandai sumber pesan
        };

        // Handle file
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name;
            dataToStore.caption = message.caption || "";
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileType = "photo";
            dataToStore.caption = message.caption || "";
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            dataToStore.caption = message.caption || "";
        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            dataToStore.caption = message.caption || "";
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
        kirimPesan(telegramAdminID, `Pemrosesan pesan di channel "${channelTitle}" selesai. Total ${fileCounter} file disimpan.`);
        scriptProperties.deleteProperty('lastProcessedMessageId'); // Hapus lastProcessedMessageId
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
// --- Fungsi untuk membuat trigger waktu (Jalankan sekali) ---
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

// --- Fungsi untuk menjawab inline query ---
function answerInlineQuery(inlineQueryId, results, nextOffset) {
    let data = {
        method: "post",
        payload: {
            method: "answerInlineQuery",
            inline_query_id: String(inlineQueryId),
            results: JSON.stringify(results),
            cache_time: 10,
            is_personal: true,
            next_offset: String(nextOffset)
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

// --- doPost (Untuk Forward Pesan, Upload, dan Inline Query) ---
function doPost(e) {
    let update = JSON.parse(e.postData.contents);

    // --- Handle Inline Query ---
    if (update.inline_query) {
        let query = update.inline_query.query;
        let inlineQueryId = update.inline_query.id;
        let offset = parseInt(update.inline_query.offset) || 0;

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
            if (startRow < 1) startRow = 1;

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
        return; // Penting!
    }


    // --- Handle Forward Pesan, Upload, dan /start (oleh Admin) ---
    if (update.message && update.message.from.id == telegramAdminID) {
        let message = update.message;
        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: (message.from.username || ""),
            first_name: message.from.first_name || "",
            chat_id: message.chat.id,
            source: "forwarded" // Tandai pesan yang di-forward/upload
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

        // Handle file
        let fileId, fileType, fileName;
        if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name;
            dataToStore.caption = message.caption || "";
        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id;
            fileType = "photo";
            dataToStore.caption = message.caption || "";
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name;
            dataToStore.caption = message.caption || "";
        } else if (message.audio) {
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name;
            dataToStore.caption = message.caption || "";
        } else if (message.text) {
            // Handle command /start (hanya untuk admin)
            if (message.text == "/start") {
                kirimPesan(message.chat.id, "Selamat datang Admin. Silahkan forward file untuk disimpan, atau tambahkan bot ini ke channel sebagai admin.");
                return;
            }
        } else {
            // Jenis pesan tidak didukung
            kirimPesan(telegramAdminID, "Jenis pesan ini tidak didukung untuk disimpan.");
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
    }
}
