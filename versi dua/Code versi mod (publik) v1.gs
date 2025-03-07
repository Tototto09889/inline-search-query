const telegramAPIToken = "7680446501:AAFwSWuv8tdDHdpm35KEH5O-aDvWFEiqRd0"; // Ganti dengan API token bot Anda
const telegramAPIURL = "https://api.telegram.org/bot" + telegramAPIToken;
const telegramAdminID = "2109541199"; // Ganti dengan ID admin
const googleWebAppsURL = "URL"; // URL Web Apps Anda
const googleSheetID = "10uM3IVAmewTIfYiUOx_YKAugjUm1HF3a9cWTYWPYcM8";   // ID Google Sheet
const googleSheetFile = SpreadsheetApp.openById(googleSheetID);
const googleSheetName = "DataFile"; // Nama sheet untuk menyimpan data
const telegramBotUsername = "HelenaMcr_bot"; // GANTI dengan username bot Anda (TANPA @)

// ----------------- Fungsi-fungsi Telegram API -----------------

function getMe() {
    let url = telegramAPIURL + "/getMe";
    let response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
}

function setWebhook() {
    let url = telegramAPIURL + "/setWebhook?url=" + googleWebAppsURL;
    let response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
}

function deleteWebhook() {
    let url = telegramAPIURL + "/deleteWebhook";
    let response = UrlFetchApp.fetch(url);
    Logger.log(response.getContentText());
}

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

function editMessageText(chatId, messageId, text, replyMarkup) {
    let data = {
        method: "post",
        payload: {
            method: "editMessageText",
            chat_id: String(chatId),
            message_id: String(messageId),
            text: text,
            parse_mode: "HTML",
            reply_markup: replyMarkup
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

function deleteMessage(chatId, messageId) {
    let data = {
        method: "post",
        payload: {
            method: "deleteMessage",
            chat_id: String(chatId),
            message_id: String(messageId)
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

function kirimChatAction(chatid, action) {
    let data = {
        method: "post",
        payload: {
            method: "sendChatAction",
            chat_id: String(chatid),
            action: String(action)
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

function answerInlineQuery(inlineQueryId, results, nextOffset) {
    let data = {
        method: "post",
        payload: {
            method: "answerInlineQuery",
            inline_query_id: String(inlineQueryId),
            results: JSON.stringify(results),
            cache_time: 120,
            is_personal: true,
            next_offset: nextOffset || ""
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

function answerCallbackQuery(callbackQueryId) {
    let data = {
        method: "post",
        payload: {
            method: "answerCallbackQuery",
            callback_query_id: String(callbackQueryId),
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

// ----------------- Fungsi-fungsi Bantuan -----------------

function getMenuKeyboard() {
    return {
        inline_keyboard: [
            [{ text: "🔍 Cari", callback_data: "cari" }],
            [{ text: "Indeks", callback_data: "indeks" }, { text: "Tentang", callback_data: "tentang" }],
            [{ text: "Bantuan", callback_data: "help" }],
            [{ text: "Tutup", callback_data: "tutup" }]
        ]
    };
}


function showIndexPage(chatId, messageId, pageNumber) {
    let sheet = googleSheetFile.getSheetByName(googleSheetName);
    let data = sheet.getDataRange().getValues();
    let headers = data[0];
    let filesPerPage = 10;
    let startIndex = (pageNumber - 1) * filesPerPage + 1; // +1 karena baris pertama adalah header
    let endIndex = Math.min(startIndex + filesPerPage, data.length); // Batasi hingga akhir data

    let indexText = "<b>Indeks File (Halaman " + pageNumber + "):</b>\n\n";

    for (let i = startIndex; i < endIndex; i++) {
        let row = data[i];
        let rowData = {};
        for (let j = 0; j < headers.length; j++) {
            rowData[headers[j]] = row[j];
        }
        indexText += `• ${rowData.file_name || 'Tidak Ada Nama'}\n`;
    }


    // Buat tombol navigasi
    let keyboard = { inline_keyboard: [] };
    let navRow = [];

    if (pageNumber > 1) {
        navRow.push({ text: "Sebelumnya", callback_data: "index_page_" + (pageNumber - 1) });
    }
    if (endIndex < data.length) {
        navRow.push({ text: "Berikutnya", callback_data: "index_page_" + (pageNumber + 1) });
    }
    if (navRow.length > 0) {
        keyboard.inline_keyboard.push(navRow);
    }

    // Tambahkan tombol "Kembali ke Menu Utama"
    keyboard.inline_keyboard.push([{ text: "Kembali ke Menu Utama", callback_data: "kembali_ke_menu" }]);

    editMessageText(chatId, messageId, indexText, JSON.stringify(keyboard));
}



function showHelp(chatId, messageId) {
    let helpText = `<b>Panduan Penggunaan Bot:</b>

<b>Mode Inline:</b>
• Ketik @${telegramBotUsername} di kolom chat, diikuti dengan spasi dan kata kunci pencarian.
• Hasil pencarian akan muncul secara otomatis.
• Pilih file yang diinginkan dari daftar hasil.
• Setelah memilih, bot akan mengirimkan pesan berisi detail file dan tombol untuk membagikannya.

<b>Perintah /start:</b>
• Mengirimkan pesan selamat datang dengan menu utama.
• Menu utama berisi tombol untuk:
    • <b>🔍 Cari:</b> Langsung memulai mode inline.
    • <b>Indeks:</b> Menampilkan daftar file yang diurutkan (dengan navigasi halaman).
    • <b>Tentang:</b> Menampilkan informasi tentang bot.
    • <b>Bantuan:</b> Menampilkan pesan bantuan ini.
    • <b>Tutup:</b> Menutup pesan.

<b>Perintah /help:</b>
• Menampilkan pesan bantuan ini (sama seperti tombol "Bantuan" di menu utama).

<b>Catatan:</b>
• Hanya admin yang dapat mengunggah atau meneruskan file ke bot untuk disimpan.
`;

    let helpKeyboard = {
        inline_keyboard: [
            [{ text: "Kembali ke Menu Utama", callback_data: "kembali_ke_menu" }],
            [{ text: "Tutup", callback_data: "tutup" }]
        ]
    };

    if (messageId) {
        editMessageText(chatId, messageId, helpText, JSON.stringify(helpKeyboard));
    } else {
        kirimPesan(chatId, helpText, JSON.stringify(helpKeyboard));
    }
}

// ----------------- Fungsi untuk Menyimpan ke Sheet -----------------

function simpanSheets(objectData) {
    let sheet = googleSheetFile.getSheetByName(googleSheetName);
    let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Buat baris baru dengan data
    let newRow = headers.map(header => objectData[header] || "");

    // Tambahkan baris baru ke sheet
    sheet.appendRow(newRow);
    return "File berhasil disimpan!";
}

// ----------------- Fungsi Utama (doPost) -----------------

function doPost(e) {
    let update = JSON.parse(e.postData.contents);

    // --- Handle Chosen Inline Result ---
    if (update.chosen_inline_result) {
        let resultId = update.chosen_inline_result.result_id;
        let userId = update.chosen_inline_result.from.id;

        let sheet = googleSheetFile.getSheetByName(googleSheetName);
        let data = sheet.getDataRange().getValues();
        let headers = data[0];
        let fileData = null;

        let rowIndex = parseInt(resultId);

        if (rowIndex > 0 && rowIndex < data.length) {
            let row = data[rowIndex];
            let rowData = {};
            for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = row[j];
            }
            fileData = rowData;
        }

        if (fileData) {
            let inlineKeyboard = {
                inline_keyboard: [
                    [{ text: "Bagikan", url: `https://t.me/share/url?url=${encodeURIComponent("Deskripsi File Anda Disini. Contoh: " + fileData.file_name + " - " + fileData.caption)}&text=${encodeURIComponent("Klik link berikut: ")}` }]
                ]
            };

            let messageText = `<b>Nama File:</b> ${fileData.file_name || 'Tidak Ada Nama'}\n<b>Keterangan:</b> ${fileData.caption || 'Tidak Ada Keterangan'}`;
            kirimPesan(userId, messageText, JSON.stringify(inlineKeyboard));

        } else {
            kirimPesan(userId, "File tidak ditemukan.");
        }

        return;
    }

    // --- Handle Callback Query ---
    if (update.callback_query) {
        let callbackData = update.callback_query.data;
        let chatId = update.callback_query.message.chat.id;
        let messageId = update.callback_query.message.message_id;


        if (callbackData === "cari") {
            answerCallbackQuery(update.callback_query.id);
        } else if (callbackData === "tentang") {
            let aboutText = "Saya adalah bot pencari file. Anda dapat mencari file yang diunggah oleh admin.";
            editMessageText(chatId, messageId, aboutText, JSON.stringify(getMenuKeyboard()));
            answerCallbackQuery(update.callback_query.id);
        } else if (callbackData === "indeks") {
            showIndexPage(chatId, messageId, 1);
            answerCallbackQuery(update.callback_query.id);
        } else if (callbackData.startsWith("index_page_")) {
            let pageNumber = parseInt(callbackData.split("_")[2]);
            showIndexPage(chatId, messageId, pageNumber);
            answerCallbackQuery(update.callback_query.id);
        } else if (callbackData === "kembali_ke_menu") {
            let menuText = `Hai ${update.callback_query.from.first_name} 👋!\nAku adalah ${telegramBotUsername}\n\nDi sini kamu bisa mencari anime yang sudah terdaftar dalam databaseku.`;
            editMessageText(chatId, messageId, menuText, JSON.stringify(getMenuKeyboard()));
            answerCallbackQuery(update.callback_query.id);
        }
        else if (callbackData === "help") {
            showHelp(chatId, messageId);
            answerCallbackQuery(update.callback_query.id);
        }

        else if (callbackData === "tutup") {
            deleteMessage(chatId, messageId);
            answerCallbackQuery(update.callback_query.id);
        }

        return;
    }

    // --- Handle Inline Query ---
    if (update.inline_query) {
        let query = update.inline_query.query;
        let inlineQueryId = update.inline_query.id;
        let offset = parseInt(update.inline_query.offset) || 0;

        let sheet = googleSheetFile.getSheetByName(googleSheetName);
        let data = sheet.getDataRange().getValues();
        let headers = data[0];
        let results = [];
        let totalResults = 0;
        let nextOffset = "";

        if (query.length === 0) {
            for (let i = 1; i < data.length && results.length < 50; i++) {
                let row = data[i];
                let rowData = {};
                for (let j = 0; j < headers.length; j++) {
                    rowData[headers[j]] = row[j];
                }

                let fileId = rowData.file_id;
                if (fileId) {
                    let result = {
                        type: "document",
                        id: String(i),
                        title: rowData.file_name || "File",
                        document_file_id: fileId,
                        caption: `Nama File: ${rowData.file_name || 'Tidak Ada Nama'}\nKeterangan: ${rowData.caption || 'Tidak Ada Keterangan'}\nDiunggah oleh: @${rowData.username || 'Tidak Diketahui'}\nTimestamp: ${rowData.timestamp || 'Tidak Diketahui'}`
                    };
                    results.push(result);
                }
            }

            answerInlineQuery(inlineQueryId, results);
            return;

        }

        if (query.length < 3 && query.length > 0) {
            let noQueryMessage = {
                type: "article",
                id: "noquery",
                title: "Minimal 3 Karakter",
                input_message_content: {
                    message_text: "Minimal 3 Karakter."
                }
            };
            answerInlineQuery(inlineQueryId, [noQueryMessage]);
            return;
        }

        for (let i = 1; i < data.length; i++) {
            let row = data[i];
            let rowData = {};
            for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = row[j];
            }

            if (Object.values(rowData).some(value => String(value).toLowerCase().includes(query.toLowerCase()))) {
                totalResults++;

                if (results.length < 50 && totalResults > offset) {
                    let fileId = rowData.file_id;
                    if (fileId) {
                        let result = {
                            type: "document",
                            id: String(offset + results.length + 1),
                            title: rowData.file_name || "File",
                            document_file_id: fileId,
                            caption: `Nama File: ${rowData.file_name || 'Tidak Ada Nama'}\nKeterangan: ${rowData.caption || 'Tidak Ada Keterangan'}\nDiunggah oleh: @${rowData.username || 'Tidak Diketahui'}\nTimestamp: ${rowData.timestamp || 'Tidak Diketahui'}`
                        };
                        results.push(result);
                    }
                }
            }
        }

        if (totalResults > offset + results.length) {
            nextOffset = String(offset + results.length);
        }

        let infoResult = [];
        if (query.length >= 3) {
            let titleText;
            if (totalResults === 0) {
                titleText = "Tidak ada hasil untuk '" + query + "'";
            } else if (totalResults <= 50) {
                titleText = totalResults + " hasil untuk '" + query + "'";
            } else {
                titleText = "50+ hasil untuk '" + query + "'";
            }

            infoResult = [{
                type: "article",
                id: "info",
                title: titleText,
                input_message_content: {
                    message_text: titleText
                }
            }];
        }
                answerInlineQuery(inlineQueryId, infoResult.concat(results), nextOffset);
        return;
    }

    // --- Handle Pesan (Umum dan Admin) ---
    if (update.message) {
        let message = update.message;
        let userId = message.from.id;

        // Cek apakah ini admin
        if (userId == telegramAdminID) {
            // --- Handle Pesan dari Admin ---
            if (message.text) {
                if (message.text.toLowerCase() === "/start") {
                    let firstName = update.message.from.first_name;
                    let startText = `Hai ${firstName} 👋!\nAku adalah ${telegramBotUsername}\n\nDi sini kamu bisa mencari anime yang sudah terdaftar dalam databaseku.`;
                    kirimPesan(userId, startText, JSON.stringify(getMenuKeyboard()));
                    return;

                } else if (message.text.toLowerCase() === "/help") {
                    showHelp(userId);
                    return;
                }
            }

            // --- LOGIKA PENYIMPANAN FILE (HANYA UNTUK ADMIN) ---
            let dataToStore = {
                message_id: message.message_id,
                timestamp: new Date(message.date * 1000).toISOString(),
                username: (message.from.username || ""),
                first_name: message.from.first_name || "",
                chat_id: message.chat.id
            };

            if (message.forward_from || message.forward_from_chat) {
                dataToStore.forwarded_from_id = (message.forward_from ? message.forward_from.id : message.forward_from_chat.id);
                dataToStore.forwarded_from_username = (message.forward_from ? (message.forward_from.username || "") : (message.forward_from_chat.username || ""));
                dataToStore.forwarded_from_name = message.forward_from ? message.forward_from.first_name : message.forward_from_chat.title;
                dataToStore.forwarded_message_id = message.forward_from_message_id;
                dataToStore.caption = (message.caption || "");
            }

            let fileId, fileType, fileName;
            if (message.document || message.photo || message.video || message.audio) {
                if (message.document) {
                    fileId = message.document.file_id;
                    fileType = "document";
                    fileName = message.document.file_name;
                    dataToStore.caption = (message.caption || "");
                } else if (message.photo) {
                    fileId = message.photo[message.photo.length - 1].file_id;
                    fileType = "photo";
                    dataToStore.caption = (message.caption || "");
                } else if (message.video) {
                    fileId = message.video.file_id;
                    fileType = "video";
                    fileName = message.video.file_name;
                    dataToStore.caption = (message.caption || "");
                } else if (message.audio) {
                    fileId = message.audio.file_id;
                    fileType = "audio";
                    fileName = message.audio.file_name;
                    dataToStore.caption = (message.caption || "");
                }

                dataToStore.file_id = fileId;
                dataToStore.file_type = fileType;
                dataToStore.file_name = fileName;

                let resultMessage = simpanSheets(dataToStore);
                kirimPesan(telegramAdminID, resultMessage);
                return;

            } else {
                kirimPesan(telegramAdminID, "Silakan forward atau unggah file.");
                return;
            }

        } else {
            // --- Handle Pesan dari Pengguna Non-Admin ---
            if (message.text) {
                if (message.text.toLowerCase() === "/start") {
                    let firstName = message.from.first_name;
                     let startText = `Hai ${firstName} 👋!\nAku adalah ${telegramBotUsername}\n\nDi sini kamu bisa mencari anime yang sudah terdaftar dalam databaseku.`;
                    kirimPesan(userId, startText, JSON.stringify(getMenuKeyboard()));
                    return;
                } else if (message.text.toLowerCase() === "/help") {
                    showHelp(userId);
                    return;
                }
            }
            return;
        }
    }
}


