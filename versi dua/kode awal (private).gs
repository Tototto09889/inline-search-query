const telegramAPIToken = "7680446501:AAFwSWuv8tdDHdpm35KEH5O-aDvWFEiqRd0"; // Ganti dengan API token bot Anda
const telegramAPIURL = "https://api.telegram.org/bot" + telegramAPIToken;
const telegramAdminID = "2109541199"; // Ganti dengan ID admin
// const telegramBotID = "GANTI_DENGAN_ID_BOT_ANDA";  // Tidak diperlukan lagi
// const telegramBotUsername = "GANTI_DENGAN_USERNAME_BOT_ANDA_TANPA_AWALAN_@"; // Tidak diperlukan
const googleWebAppsURL = "URL"; // URL Web Apps Anda
const googleSheetID = "10uM3IVAmewTIfYiUOx_YKAugjUm1HF3a9cWTYWPYcM8";   // ID Google Sheet
const googleSheetFile = SpreadsheetApp.openById(googleSheetID);
const googleSheetName = "DataFile"; // Nama sheet untuk menyimpan data (bisa diubah)

// const googleSheetPublishURL = "GANTI_DENGAN_URL_GOOGLE_SHEET_ANDA_YANG_TELAH_DIPUBLIKASI"; // Tidak diperlukan lagi, kecuali untuk tampilan web

/***************************************************************
* getMe() untuk request info tentang bot *
* setWebHook() untuk membangun push system realtime dengan bot *
* deleteWebhook() menghapus koneksi yang dibangun setWebhook *
****************************************************************/
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



/*********************
* FUNGSI KIRIM PESAN *
**********************/
function kirimPesan(targetID, pesan, replymarkup) {
    let dataPesan = {
        method: "post",
        payload: {
            method: "sendMessage",
            parse_mode: "HTML",
            disable_web_page_preview: "true",  // Lebih baik dimatikan
            chat_id: String(targetID),
            text: String(pesan),
            reply_markup: replymarkup
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", dataPesan);
}

/*********************************
* KIRIM NOTIFIKASI STATUS PROSES *  (Tidak terlalu penting untuk fungsionalitas utama, bisa dihapus jika mau)
**********************************/
function kirimChatAction(chatid, action) {
    var dataAction = {
        method: "post",
        payload: {
            method: "sendChatAction",
            chat_id: String(chatid),
            action: action
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", dataAction);
}


/*************
* SAVE2SHEET *
**************/
function simpanSheets(objectData) { // Hapus googleSheetName, pakai yang global
    try {
        let googleSheetData = googleSheetFile.getSheetByName(googleSheetName) || googleSheetFile.insertSheet(googleSheetName);
        let headers = googleSheetData.getRange(1, 1, 1, Object.keys(objectData).length).getValues()[0];

        // Pengecekan dan penyesuaian header
        for (let i = 0; i < Object.keys(objectData).length; i++) {
            if (headers[i] !== Object.keys(objectData)[i]) {
                 googleSheetData.getRange(1, i + 1).setValue(Object.keys(objectData)[i]);
            }
        }


        let values = [Object.values(objectData)];
        googleSheetData.appendRow(Object.values(objectData)); // Gunakan appendRow, lebih efisien

        return "Data berhasil disimpan!"; // Pesan sukses yang lebih sederhana

    } catch (e) {
        return "Terjadi kesalahan saat menyimpan data: " + e; // Pesan error yang lebih informatif
    }
}


/*********************************
 *  FUNGSI PENCARIAN INLINE      *
 *********************************/

function answerInlineQuery(inlineQueryId, results) {
    let data = {
        method: "post",
        payload: {
            method: "answerInlineQuery",
            inline_query_id: String(inlineQueryId),
            results: JSON.stringify(results),
            cache_time: 10, // Cache 10 detik, bisa disesuaikan
            is_personal: true  // Hasil pencarian hanya untuk pengguna yang mencari
        }
    };
    UrlFetchApp.fetch(telegramAPIURL + "/", data);
}

/*************************************************************
* FUNGSI PENERIMA KIRIMAN DATA DARI TELEGRAM API VIA WEBHOOK *
**************************************************************/

function doPost(e) {
    let update = JSON.parse(e.postData.contents);

    // Handle inline queries
    if (update.inline_query) {
        let query = update.inline_query.query;
        let inlineQueryId = update.inline_query.id;

        if (query.length < 3) {  // Minimal 3 karakter untuk pencarian (bisa disesuaikan)
            answerInlineQuery(inlineQueryId, []); // Tidak ada hasil jika kurang dari 3 karakter
            return;
        }

        let sheet = googleSheetFile.getSheetByName(googleSheetName);
        let data = sheet.getDataRange().getValues();
        let headers = data[0]; // Ambil header
        let results = [];

        // Pencarian data
         for (let i = 1; i < data.length; i++) { // Mulai dari baris kedua (data)
            let row = data[i];
            let rowData = {}; // Buat objek sementara untuk baris ini
             for (let j = 0; j < headers.length; j++) {
                rowData[headers[j]] = row[j]; // Isi objek dengan data baris
            }


            // Cek apakah query ada di dalam data (case-insensitive)
            if (Object.values(rowData).some(value => String(value).toLowerCase().includes(query.toLowerCase()))) {
                let fileId = rowData.file_id; // Asumsi ada kolom 'file_id'

                if (fileId) {
                    let result = {
                        type: "document", // Bisa diganti photo, video, dll, sesuai jenis file
                        id: String(i),  // ID unik untuk hasil pencarian
                        title: rowData.file_name || "File", // Judul hasil, ambil dari nama file jika ada
                        document_file_id: fileId, // ID file yang ditemukan
                        caption:  `File Name: ${rowData.file_name || 'Tidak Ada Nama'}\nCaption: ${rowData.caption || 'Tidak Ada Caption'}\nUploaded by: @${rowData.username || 'Tidak Diketahui'}\nTimestamp: ${rowData.timestamp || 'Tidak Diketahui'}` //caption

                    };
                      results.push(result);
                }


            }
            if (results.length >= 50) break; // Batasi hasil pencarian (max 50)

        }

        answerInlineQuery(inlineQueryId, results);
        return; // Penting, hentikan eksekusi setelah handle inline query
    }



    // Handle pesan dari admin
    if (update.message && update.message.from.id == telegramAdminID) {
        let message = update.message;

        // Data yang akan disimpan
        let dataToStore = {
            message_id: message.message_id,
            timestamp: new Date(message.date * 1000).toISOString(),
            username: (message.from.username || ""),  // Username, bisa kosong
             first_name: message.from.first_name || "",
            chat_id: message.chat.id
        };

        // Handle pesan yang diforward
        if (message.forward_from || message.forward_from_chat) {
            dataToStore.forwarded_from_id = (message.forward_from ? message.forward_from.id : message.forward_from_chat.id);
            dataToStore.forwarded_from_username = (message.forward_from ? (message.forward_from.username || "") : (message.forward_from_chat.username || ""));
             dataToStore.forwarded_from_name = message.forward_from ? message.forward_from.first_name: message.forward_from_chat.title;
            dataToStore.forwarded_message_id = message.forward_from_message_id;
            dataToStore.caption = (message.caption || "");  // Ambil caption jika ada
        }


        // Handle file (dokumen, foto, video, audio, dll)
        let fileId, fileType, fileName;

         if (message.document) {
            fileId = message.document.file_id;
            fileType = "document";
            fileName = message.document.file_name;
              dataToStore.caption = (message.caption || "");

        } else if (message.photo) {
            fileId = message.photo[message.photo.length - 1].file_id; // Ambil foto dengan resolusi tertinggi
            fileType = "photo";
             dataToStore.caption = (message.caption || "");
        } else if (message.video) {
            fileId = message.video.file_id;
            fileType = "video";
            fileName = message.video.file_name;
             dataToStore.caption = (message.caption || "");
        } else if(message.audio){
            fileId = message.audio.file_id;
            fileType = "audio";
            fileName = message.audio.file_name;
            dataToStore.caption = (message.caption || "");
        }
        else if (message.text){
            //handle text
            if(message.text=="/start"){
                 kirimPesan(message.chat.id,"Selamat datang Admin. Silahkan forward atau upload file untuk disimpan.");
                return;
            } else {
                 kirimPesan(message.chat.id,"Silahkan forward atau upload file.");
                return;
            }
        }

        else {
            // Tipe pesan lain yang tidak didukung
            kirimPesan(telegramAdminID, "Jenis pesan ini tidak didukung untuk disimpan.");
            return;
        }

        dataToStore.file_id = fileId;
        dataToStore.file_type = fileType;
        dataToStore.file_name = fileName;


        // Simpan data ke sheet
        let resultMessage = simpanSheets(dataToStore);
        kirimPesan(telegramAdminID, resultMessage);

    } else if (update.message) {
        // Pesan dari user non-admin
        kirimPesan(update.message.chat.id, "Maaf, Anda tidak memiliki akses untuk menggunakan bot ini.");
    }
}
